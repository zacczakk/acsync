---
summary: "Decision record: three-tier MCP access — native, mcporter, compiled binaries."
read_when:
  - "Evaluating MCP server architecture"
  - "Adding or removing MCP servers"
---

# MCP Access Architecture

> Decision record for three-tier MCP server access across all 4 CLIs
> (Claude Code, OpenCode, Gemini, Codex).

## Context

7 canonical MCP servers in `configs/mcp/`. 4 CLI targets with different
transport support (Codex: HTTP-only). MCPorter 0.7.3 installed via Homebrew.

## Decision

Three access tiers, fastest first:

1. **Compiled binaries** (`bin/`, on PATH) — Bun-compiled standalone CLIs
   with baked-in schemas. No runtime deps. ~0.3s discovery, ~2.3s HTTP call.
2. **MCPorter calls** (`mcporter call`) — ad-hoc invocation via bash.
   ~800ms overhead vs binary. Daemon for chrome-devtools.
3. **Native MCP** — high-frequency servers (context7, tavily) stay native
   for schema-at-load and streaming.

### Server Matrix

| Server              | Native MCP            | Binary (PATH) | MCPorter              |
|---------------------|-----------------------|---------------|-----------------------|
| context7            | All 4 CLIs            | `context7`    | `mcporter call`       |
| tavily              | Claude, OC, Gemini    | `tavily`      | `mcporter call`       |
| chrome-devtools     | —                     | `chrome-devtools` | daemon (keep-alive) |
| palantir-mcp        | —                     | `palantir`    | ephemeral             |
| liquid-carbon       | —                     | `liquid-carbon` | ephemeral           |
| shadcn              | —                     | `shadcn`      | ephemeral             |
| sequential-thinking | — (disabled)          | `sequential-thinking` | ephemeral     |

## Why Three Tiers

### Compiled binaries

- Fastest path: skip mcporter overhead, schemas embedded at build time.
- Globally accessible via PATH (`~/Repos/acsync/bin/`).
- Self-contained Bun executables — no node/bun runtime on target.
- Generated via `mcporter generate-cli --compile`.
- `--flag` syntax (not `key=value`): `context7 resolve-library-id --query "react" --library-name react`.

### MCPorter calls

- Ad-hoc — any agent with bash can call any registered server.
- Config: `~/.mcporter/mcporter.json` (system-level, no editor imports).
- Daemon keeps chrome-devtools warm (`lifecycle: keep-alive`).
- Discovery: `mcporter config list` (77ms, no connections). Never bare `mcporter list`.

### Native MCP

- context7 + tavily: high-frequency, schema visible at agent context load.
- Streaming support; no bash output parsing overhead.
- Managed by `acsync push` from `configs/mcp/`.

## MCPorter Config

`~/.mcporter/mcporter.json` — all 7 canonical servers, no `imports` array.
Editor configs (Cursor, OpenCode) are intentionally excluded to avoid
slow discovery and duplicate definitions.

## Performance (benchmarked)

| Operation | Binary | mcporter call |
|---|---|---|
| Discovery (help/schemas) | ~0.3s | 2-3s |
| HTTP tool call (context7) | ~2.3s | ~3.1s |
| stdio tool call (shadcn) | ~2.2s | ~1.8s |
| Server list (no connect) | n/a | 77ms (`config list`) |

Key insight: for stdio servers, npx cold start dominates — binary vs mcporter
is roughly equal. Binaries win on HTTP calls and discovery. Daemon wins for
repeated stdio calls (warm connection).

## File Layout

```
~/.mcporter/mcporter.json       MCPorter server registry (all 7)
~/Repos/acsync/bin/              Compiled binaries (on PATH)
~/Repos/acsync/scripts/          Source scripts (on PATH)
~/Repos/acsync/configs/mcp/      Canonical server definitions (acsync push)
```

## Risks

| Risk | Mitigation |
|---|---|
| npx cold-start latency | Daemon for chrome-devtools; binaries for discovery |
| No tool schemas at agent startup | Binaries embed schemas; `mcporter config list` for fast discovery |
| MCPorter version drift | Homebrew; rebuild binaries after upgrade |
| Secret exposure | `${VAR}` interpolation from env; no plaintext in config |

## References

- [MCPorter GitHub](https://github.com/steipete/mcporter)
- [MCPorter Daemon Design](https://github.com/steipete/mcporter/blob/main/docs/daemon.md)
- `configs/instructions/TOOLS.md` §mcporter for agent usage
