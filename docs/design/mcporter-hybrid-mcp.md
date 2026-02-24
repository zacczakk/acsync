# MCPorter Hybrid MCP Analysis

> Decision record for migrating from all-native MCP servers to a hybrid
> native + MCPorter setup across all 4 CLIs (Claude Code, OpenCode, Gemini, Codex).

## Context

7 canonical MCP servers managed in `configs/common/mcp/`, rendered to 4 CLI
formats via agent-driven sync (~140 lines of MCP rendering logic in SYNC.md).
Codex limited to HTTP-only transport — gets 1 of 7 servers (context7).

[MCPorter](https://github.com/steipete/mcporter) is a TypeScript MCP client/CLI
that calls MCP servers from the terminal via `mcporter call <server>.<tool>`.
It auto-discovers configs, manages a persistent daemon for stateful servers,
and works from any CLI that has bash access.

## Decision

**Hybrid setup.** Keep high-frequency servers as native MCP. Route the rest
through MCPorter (agent calls via bash).

### Server Matrix

| Server              | Method                | CLIs   | Notes                             |
|---------------------|-----------------------|--------|-----------------------------------|
| context7            | Native MCP            | All 4  | HTTP; works everywhere            |
| tavily              | Native MCP            | Claude | Others use WebFetch               |
| sequential-thinking | Native MCP (disabled) | None   | `"enabled": false`; retained      |
| chrome-devtools     | MCPorter (daemon)     | All 4  | `"lifecycle": "keep-alive"`       |
| palantir-mcp        | MCPorter (ephemeral)  | All 4  | Requires `PALANTIR_FOUNDRY_TOKEN` |
| liquid-carbon       | MCPorter (ephemeral)  | All 4  |                                   |
| shadcn              | MCPorter (ephemeral)  | All 4  |                                   |

## Why Hybrid

### Why not all-native (current)

- Sync complexity: 7 servers × 4 CLI formats × secret injection.
- Codex gets only 1 server (HTTP-only limitation).
- chrome-devtools cold-starts a new stdio process per session; no state persistence.

### Why not all-MCPorter

- High-frequency servers (context7, tavily) benefit from native schema integration:
  agents see tool definitions at context load, no discovery step needed.
- Native MCP supports streaming; MCPorter bash calls are blocking.
- Fewer tokens per call (no bash output parsing overhead).

### Why hybrid wins

- context7 + tavily stay native: fast, schema-aware, low overhead.
- MCPorter handles the long tail: lower frequency, less latency-sensitive.
- chrome-devtools gets daemon keep-alive: warm CDP connection across sessions.
- Codex goes from 1 server to all 7 (via bash — no transport limitation).
- Sync simplifies: 3 canonical files (context7, tavily, sequential-thinking)
  instead of 7. ~60% less MCP rendering logic in SYNC.md.

## MCPorter Architecture

### Daemon (chrome-devtools)

```
Agent Session 1                Agent Session 2
     │                              │
     ▼                              ▼
mcporter call                    mcporter call
chrome-devtools.take_snapshot    chrome-devtools.click uid=X
     │                              │
     └──────────┐  ┌────────────────┘
                ▼  ▼
        ~/.mcporter/daemon.sock
          (Unix domain socket)
                │
                ▼
         MCPorter Daemon
         (background process)
                │
                ▼
        chrome-devtools-mcp
        (single stdio process,
         warm CDP connection)
```

- Auto-starts on first call to a keep-alive server — no manual `daemon start`.
- Multiple CLI calls reuse the same warm connection via Unix socket.
- Auto-restarts if daemon crashes.
- `mcporter daemon stop` tears down everything.
- chrome-devtools is in the hardcoded allowlist — zero config needed.

### Ephemeral Servers (palantir-mcp, liquid-carbon, shadcn)

- `mcporter call <server>.<tool> <args>` spawns transport, calls, exits.
- ~1-2s overhead for npx cold start; acceptable for low-frequency tools.
- `${VAR}` interpolation for secrets from shell environment.

## Implementation Plan

### Step 1: Update MCPorter

```bash
brew upgrade mcporter   # 0.7.3 → latest
mcporter --version
```

### Step 2: Create `~/.mcporter/mcporter.json`

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"],
      "lifecycle": "keep-alive"
    },
    "palantir-mcp": {
      "command": "npx",
      "args": ["-y", "palantir-mcp", "--foundry-api-url", "${FOUNDRY_HOST}"],
      "env": {
        "FOUNDRY_TOKEN": "${PALANTIR_FOUNDRY_TOKEN}"
      }
    },
    "liquid-carbon": {
      "command": "liquid-carbon-mcp",
      "args": []
    },
    "shadcn": {
      "command": "npx",
      "args": ["shadcn@latest", "mcp"]
    }
  }
}
```

### Step 3: Verify MCPorter discovery

```bash
mcporter list                       # all 4 servers visible
mcporter list chrome-devtools       # tools listed
mcporter daemon start               # chrome-devtools warm
mcporter daemon status              # confirm connected
```

### Step 4: Modify canonical MCP configs

**Delete** from `configs/common/mcp/` (trash, not rm):

- `chrome-devtools-mcp.json`
- `palantir-mcp.json`
- `liquid-carbon.json`
- `shadcn.json`

**Edit** `sequential-thinking.json` — add `"enabled": false`:

```json
{
  "description": "Sequential thinking and reasoning MCP server",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
  "enabled": false,
  "disabled_for": ["codex"]
}
```

**Edit** `tavily.json` — restrict to Claude only:

```json
{
  "description": "Tavily web search and content extraction",
  "transport": "stdio",
  "command": "python",
  "args": ["-m", "tavily_mcp"],
  "env_vars": ["TAVILY_API_KEY"],
  "env": { "TAVILY_API_KEY": "${TAVILY_API_KEY}" },
  "disabled_for": ["opencode", "gemini", "codex"]
}
```

**Remaining** `configs/common/mcp/`: 3 files (context7.json, tavily.json, sequential-thinking.json).

### Step 5: Update AGENTS.md

Add to `## Tools`:

```markdown
### mcporter
- MCP launcher for non-native servers. Keeps chrome-devtools warm via daemon.
- Usage: `mcporter call <server>.<tool> <args>` or `mcporter list <server>`
- Servers: chrome-devtools (daemon), palantir-mcp, liquid-carbon, shadcn.
- Config: `~/.mcporter/mcporter.json`
- Daemon: auto-starts on first keep-alive call; `mcporter daemon stop` to tear down.
```

Update web search line:

```
- Web: search early; prefer 2025–2026 sources. Claude: Tavily MCP; others: WebFetch + Tavily search tool.
```

### Step 6: Update `docs/tools.md`

```markdown
## MCP Servers (Native)
- `context7`: Documentation retrieval (all CLIs).
- `tavily`: Web search/extract (Claude Code only).
- `sequential-thinking`: Disabled.

## MCP Servers (via MCPorter)
- `chrome-devtools`: Browser automation (daemon keep-alive).
- `palantir-mcp`: Foundry access (requires `PALANTIR_FOUNDRY_TOKEN`).
- `liquid-carbon`: Liquid Carbon component library.
- `shadcn`: shadcn/ui component library.

Usage: `mcporter call <server>.<tool> <args>`
```

### Step 7: Update CLI addendums

**opencode.md** — drop tavily preference:

```markdown
## Web Access
- WebFetch works (no proxy block unlike Claude Code).
- Use WebFetch for specific URLs; Tavily search tool for broad queries.
```

**claude.md** — add MCPorter note:

```markdown
## MCPorter
Non-native MCP servers via `mcporter call`. See `## Tools` in AGENTS.md.
```

### Step 8: Simplify SYNC.md MCP section

Reduce rendering examples to context7 (all CLIs) + tavily (Claude only).
Remove chrome-devtools/palantir/liquid-carbon/shadcn examples.
Add note: "Other servers managed by MCPorter — see MCPORTER_ANALYSIS.md."

### Step 9: Sync + verify

```bash
/zz-sync-agent-configs
mcporter list --json                              # health check
mcporter call chrome-devtools.take_snapshot        # daemon test
```

## Verification Criteria

- [ ] `mcporter list` shows 4 servers, all connected
- [ ] `mcporter daemon status` shows chrome-devtools warm
- [ ] `mcporter call chrome-devtools.take_snapshot` returns data
- [ ] Claude Code sees tavily + context7 natively
- [ ] OpenCode sees context7 only natively
- [ ] Gemini sees context7 only natively
- [ ] Codex sees context7 only natively
- [ ] Sequential-thinking absent from all CLIs
- [ ] No MCPorter servers appear as native MCP in any CLI

## Risks

| Risk                                       | Mitigation                                                                  |
|--------------------------------------------|-----------------------------------------------------------------------------|
| MCPorter npx cold-start latency            | Daemon for chrome-devtools; others infrequent                               |
| Agent lacks MCPorter tool schemas at startup | `mcporter list <server>` for discovery; key tools documented in AGENTS.md  |
| MCPorter version drift                     | Brew manages updates; pin if stability issues                               |
| Palantir token exposure                    | `${VAR}` interpolation from shell env — no plaintext in config              |
| Daemon socket permissions                  | chmod 600 per-login scope; never crosses user boundaries                    |

## References

- [MCPorter GitHub](https://github.com/steipete/mcporter)
- [MCPorter Daemon Design](https://github.com/steipete/mcporter/blob/main/docs/daemon.md)
- [Anthropic: Code Execution with MCP](https://docs.anthropic.com/en/docs/agents-and-tools/mcp)
- SYNC.md §2.5 for native MCP rendering rules
