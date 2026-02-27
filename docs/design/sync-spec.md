---
summary: "Reference spec for format transformations, MCP rendering, secret handling, and merge rules."
read_when:
  - "Modifying adapter rendering logic"
  - "Adding a new CLI target"
  - "Debugging format transformation or secret injection"
---

# Sync Specification (Reference)

> **Status**: Reference document. The sync logic is implemented in the
> `acsync` TypeScript CLI (`src/adapters/`, `src/secrets/`, `src/core/`).
> This spec documents the contracts those adapters implement. It was
> originally the agent-driven playbook (SYNC.md) before the CLI existed.

---

## 1. System Paths

### Main Config Files (Subset-Merged)

| CLI | System Path | Format | MCP Key | Settings Key |
|-----|------------|--------|---------|-------------|
| Claude | `~/.claude.json` | JSON | `mcpServers` | n/a |
| Claude | `~/.claude/settings.json` | JSON | n/a | `permissions`, `env` |
| OpenCode | `~/.config/opencode/opencode.json` | JSON | `mcp` | `provider`, `plugin`, `permission`, `model`, `instructions` |
| Gemini | `~/.gemini/settings.json` | JSON | `mcpServers` | n/a |
| Codex | `~/.codex/config.toml` | TOML | `[mcp_servers.*]` sections | n/a |

### Managed Directories (Wholesale Copy/Render)

| CLI | Commands | Agents | Skills |
|-----|----------|--------|--------|
| Claude | `~/.claude/commands/*.md` | `~/.claude/agents/*.md` | `~/.claude/skills/` |
| OpenCode | `~/.config/opencode/command/*.md` | `~/.config/opencode/agents/*.md` | `~/.config/opencode/skill/` |
| Gemini | `~/.gemini/commands/*.toml` | `~/.gemini/agents/*.md` | `~/.gemini/skills/` |
| Codex | `~/.codex/prompts/*.md` | `~/.codex/prompts/agent-*.md` | `~/.codex/skills/` |

Note the naming quirks: OpenCode uses singular `command/` and `skill/`. Codex
merges commands and agents into a single `prompts/` directory.

### Canonical Sources (This Repo)

```
configs/commands/*.md              6 slash commands
configs/agents/                    Agent definitions (currently empty)
configs/skills/                    3 skill directories
configs/mcp/*.json                 7 MCP server definitions
configs/settings/*.json            2 settings definitions (claude, opencode)
configs/instructions/AGENTS.md     Unified agent operating system
configs/instructions/TOOLS.md      Tool-use reference
```

### Exclusion Rules

Never touch these during sync:
- Files or directories with `gsd-` prefix (GSD-managed)
- Directories named `gsd/` (GSD command subdirectories)
- Files named `.sync-manifest.json` (GSD artifact)
- Files named `.gsd-file-manifest.json` (GSD artifact)
- `.DS_Store` files

---

## 2. Format Specifications

### 2.1 Commands

#### Claude Code

- Canonical: `configs/commands/groom-docs.md`
- Claude system: `~/.claude/commands/groom-docs.md`
- Invoked as: `/groom-docs`

The body content is copied verbatim (no frontmatter transformation needed).

#### OpenCode — Rebuild Frontmatter + Translate Tools

Strip canonical frontmatter and rebuild with OpenCode-compatible fields.

Canonical frontmatter:
```yaml
---
description: Full CI gate...
argument-hint: [goal]
allowed-tools: [Read, Glob, Grep, Bash]
---
```

OpenCode rendered frontmatter:
```yaml
---
description: Full CI gate...
argument-hint: "goal"
tools:
  edit: false
  write: false
---
```

**`allowed-tools` translation**: OpenCode does not support the `allowed-tools`
field. Translate it to the `tools` map, which disables tools by setting them
to `false`. Only emit keys for tools that are **disabled** (absent = allowed).

Translation table (canonical tool name to OpenCode `tools` key):

| Canonical | OpenCode `tools` key |
|-----------|---------------------|
| `Read` | `read` |
| `Glob` | `glob` |
| `Grep` | `grep` |
| `Edit` | `edit` |
| `Write` | `write` |
| `Bash` | `bash` |

**Rule**: Compare the `allowed-tools` list against the full set
`[Read, Glob, Grep, Edit, Write, Bash]`. Any tool NOT in `allowed-tools`
gets `toolname: false` in the `tools` map. If all tools are allowed, omit
the `tools` key entirely.

Examples:
- `allowed-tools: [Read, Glob, Grep, Bash]` becomes `tools: {edit: false, write: false}`
- `allowed-tools: [Read, Glob, Grep, Edit, Write, Bash]` becomes no `tools` key
- `allowed-tools: [Read, Write, Bash]` becomes `tools: {glob: false, grep: false, edit: false}`

**Note on `mcp__*`**: The `mcp__*` wildcard in `allowed-tools` means "allow
all MCP tools." OpenCode does not have an equivalent restriction mechanism
for MCP tools. Omit it from the `tools` map — MCP tools are always available
when the MCP server is enabled.

**`argument-hint`**: If it is a list in canonical (e.g., `[goal]`), convert
to a plain string (e.g., `"goal"`). If it is already a string, quote it.

Body content is passed through unchanged.

#### Gemini CLI — Convert to TOML

```toml
description = "Full CI gate..."
prompt = """
# /gate -- Full CI Gate

[body content here]
"""
```

Rules:
- Extract `description` from frontmatter to a top-level TOML key.
- Strip frontmatter entirely from the body.
- Wrap body in `prompt = """..."""` (triple-quoted TOML string).
- Escape backslashes (`\` becomes `\\`).
- If `argument-hint` exists and body does not contain `{{args}}`, append
  `\nUser arguments: {args}` at end of prompt.

#### Codex — Flat Markdown

```markdown
# /gate

Full CI gate -- binary shippable/not-shippable verdict.

[body content here]

User arguments: {args}
```

Rules:
- No frontmatter.
- Start with `# /{command-name}` heading.
- Next line: the `description` as a plain paragraph.
- Then: the body content (frontmatter stripped).
- If `argument-hint` exists and body does not contain `{{args}}`, append
  `\nUser arguments: {args}` at end.

### 2.2 Agents

#### Claude Code

- Canonical: `configs/agents/{name}.md`
- Claude system: `~/.claude/agents/{name}.md`

Body content copied verbatim.

#### OpenCode — Rebuild Frontmatter + Translate Tools

Canonical agent frontmatter:
```yaml
---
name: planner
description: Goal-backward task planning...
allowed-tools: [Read, Glob, Grep, Edit, Write, Bash]
---
```

OpenCode rendered agent frontmatter:
```yaml
---
description: Goal-backward task planning...
mode: subagent
tools:
  edit: false
  write: false
---
```

Rules:
- Drop `name` (OpenCode derives it from filename).
- Drop `allowed-tools` and translate to `tools` map using the same
  translation table as commands (section 2.1).
- Add `mode: subagent` (always).
- Keep `model` if present in canonical.
- Keep `description`.
- Body content passed through unchanged.

#### Gemini CLI — Add `kind: local`

Canonical agent frontmatter:
```yaml
---
name: planner
description: Goal-backward task planning...
allowed-tools: [Read, Glob, Grep, Edit, Write, Bash]
---
```

Gemini rendered agent frontmatter:
```yaml
---
name: planner
description: Goal-backward task planning...
allowed-tools: [Read, Glob, Grep, Edit, Write, Bash]
kind: local
---
```

Rules:
- Add `kind: local` to frontmatter.
- Keep everything else as-is.

#### Codex — Flat Markdown in `prompts/agent-{name}.md`

```markdown
# Agent: planner

**Role**: Goal-backward task planning...

**Allowed Tools**: Read, Glob, Grep, Edit, Write, Bash

[body content here]
```

Rules:
- Filename: `prompts/agent-{name}.md`
- No frontmatter.
- Start with `# Agent: {name}` heading.
- Add `**Role**: {description}` line.
- Add `**Allowed Tools**: {comma-separated tools}` line.
- Then: the body content (frontmatter stripped).

### 2.3 Skills

Skills are directory trees (e.g., `vercel-react-best-practices/SKILL.md`).
Copy them verbatim to all four CLIs' skill directories. No format
transformation needed.

**Skill-MCP dependency rule**: If a skill's `SKILL.md` references MCP server
tools (e.g., `mcp__tavily_*`), verify that the referenced MCP server is
enabled for the target CLI. If the server is listed in `disabled_for` for
that CLI, warn the user and offer to force-enable it.

### 2.4 Instructions

Each CLI has a global instruction file that is auto-injected into the system
prompt at startup. A single canonical file (`configs/instructions/AGENTS.md`)
is written verbatim to each CLI's instruction path. No concatenation or
per-CLI addendums — CLI-specific notes are sections within the unified file.

#### Canonical Source

```
configs/instructions/AGENTS.md   — unified agent operating system (all CLI notes included)
```

#### Rendering Paths

| CLI | System File | How It's Loaded |
|-----|------------|-----------------|
| Claude | `~/.claude/CLAUDE.md` | Auto-discovered by filename |
| OpenCode | `~/.config/opencode/AGENTS.md` | Via `instructions` array in `opencode.json` |
| Gemini | `~/.gemini/AGENTS.md` | Via `context.fileName` setting |
| Codex | `~/.codex/AGENTS.md` | Auto-discovered by filename |

#### Push

1. Read `configs/instructions/AGENTS.md`.
2. Write content verbatim to the CLI's instruction file.

No secret injection needed (these files contain no secrets).

#### Pull

1. Read the system instruction file.
2. Compare against canonical `configs/instructions/AGENTS.md`.

#### Check

Same as pull — diff rendered vs canonical.

### 2.5 MCP Servers

The canonical MCP definition schema (`configs/mcp/*.json`):

```json
{
  "description": "Human-readable description",
  "transport": "stdio" | "http",
  "command": "...",              // stdio only
  "args": ["..."],              // stdio only
  "url": "...",                 // http only
  "headers": {"KEY": "VALUE"},  // http only
  "env_vars": ["VAR"],          // validation only — not rendered
  "env": {"KEY": "${VAR}"},     // runtime env vars — stdio only
  "enabled": true|false,        // optional, default true
  "disabled_for": ["cli"]       // optional, per-CLI exclusion
}
```

**Filtering**: Before rendering for a CLI, exclude any server where the CLI
name appears in `disabled_for`. Exception: skill-MCP force-enable (see 2.3).

**Codex special rule**: Codex only supports HTTP transport. Silently skip
all `"transport": "stdio"` servers when rendering for Codex.

#### Claude Code Format

```json
{
  "server-name": {
    "type": "stdio",
    "command": "python",
    "args": ["-m", "tavily_mcp"],
    "env": {
      "TAVILY_API_KEY": "actual-secret-value"
    }
  }
}
```

```json
{
  "server-name": {
    "type": "http",
    "url": "https://example.com/mcp",
    "headers": {
      "KEY": "actual-secret-value"
    }
  }
}
```

Rules:
- Add `"type": "stdio"` or `"type": "http"`.
- Drop `description`, `env_vars`, `transport`, `disabled_for`, `enabled`.
- Keep `command`, `args`, `env` (stdio) or `url`, `headers` (http).
- Inject real secret values (replace `${VAR}` with values from `.env`).

#### OpenCode Format

```json
{
  "server-name": {
    "type": "local",
    "command": ["python", "-m", "tavily_mcp"],
    "environment": {
      "TAVILY_API_KEY": "actual-secret-value"
    },
    "enabled": true
  }
}
```

```json
{
  "server-name": {
    "type": "remote",
    "url": "https://example.com/mcp",
    "headers": {
      "KEY": "actual-secret-value"
    },
    "enabled": true
  }
}
```

Rules:
- Type naming: `"stdio"` becomes `"local"`, `"http"` becomes `"remote"`.
- Merge `command` + `args` into a single `"command"` array
  (e.g., `"command": ["python", "-m", "tavily_mcp"]`).
  If `args` is empty, still use an array: `"command": ["liquid-carbon-mcp"]`.
- Rename `"env"` to `"environment"`.
- Add `"enabled": true` (or `false` if canonical has `"enabled": false`).
- Drop `description`, `env_vars`, `transport`, `disabled_for`.
- Inject real secret values.

#### Gemini CLI Format

```json
{
  "server-name": {
    "command": "python",
    "args": ["-m", "tavily_mcp"],
    "env": {
      "TAVILY_API_KEY": "actual-secret-value"
    }
  }
}
```

```json
{
  "server-name": {
    "url": "https://example.com/mcp",
    "headers": {
      "KEY": "actual-secret-value"
    }
  }
}
```

Rules:
- No `type` field at all.
- Keep `command`, `args`, `env` (stdio) or `url`, `headers` (http).
- Drop `description`, `env_vars`, `transport`, `disabled_for`, `enabled`.
- Inject real secret values.

#### Codex Format (TOML, HTTP only)

```toml
[mcp_servers.context7]
url = "https://mcp.context7.com/mcp"
http_headers = { "CONTEXT7_API_KEY" = "actual-secret-value" }
```

Rules:
- **HTTP only** — skip all stdio servers.
- Section header: `[mcp_servers.{name}]`.
- Use `url` key.
- Rename `headers` to `http_headers` (TOML inline table).
- Drop `description`, `env_vars`, `transport`, `disabled_for`, `enabled`.
- Inject real secret values.
- Append these sections to the end of `~/.codex/config.toml`.

---

## 3. Per-CLI Specialties

### Claude Code

- **WebFetch is blocked** by corporate proxy. All web lookups must use the
  Tavily MCP server (`python -m tavily_mcp`). The `CLAUDE.md` addendum in the
  system dir enforces this.
- **SSL certificates**: `settings.json` injects `SSL_CERT_FILE` and
  `NODE_EXTRA_CA_CERTS` pointing to `~/.claude/cacert.pem`. Canonical uses
  `~` paths; push expands `~` to the actual home directory.
- **Hooks**: `SessionStart` hook and `statusLine` are GSD-managed. Do NOT
  touch during sync.
- **Project-level MCP**: `~/.claude.json` has per-project
  `enabledMcpjsonServers`/`disabledMcpjsonServers` entries. Do NOT modify
  these during sync.
- **Claude-only skills**: The `ralph-tui-*` skills in `~/.claude/skills/` are
  Claude-only. They are not canonical (not in `configs/skills/`). Do
  NOT remove them during sync.

### OpenCode

- **Custom providers**: Two corporate proxy providers (`uptimize-bedrock`,
  `uptimize-foundry`) with explicit model context/output limits. These are
  in the `provider` key of `opencode.json`.
- **Env var syntax**: OpenCode uses `{env:VAR_NAME}` template syntax in
  provider configs (distinct from `${VAR}` used elsewhere).
- **Naming quirks**: `command/` (singular), `skill/` (singular),
  `environment` (not `env`), `local`/`remote` (not `stdio`/`http`),
  `command` as array (not string + args).
- **Deep-merge keys**: `permission` and `tools` in `opencode.json` use deep
  merge (user-added entries survive). All other managed keys use wholesale
  replacement.
- **Plugin system**: `"plugin": ["opencode-agent-browser"]` — preserve
  during sync.
- **`tools` frontmatter in commands/agents**: OpenCode supports a `tools` map
  in frontmatter to disable specific tools (see section 2.1). This is the
  translation target for canonical `allowed-tools`.

### Gemini CLI

- **Commands in TOML**: Only CLI that uses TOML for slash commands.
- **No MCP type field**: MCP entries have no `type` key.
- **OAuth auth**: Uses `"security.auth.selectedType": "oauth-personal"`.
- **Context file discovery**: `"context.fileName": ["AGENTS.md", "GEMINI.md"]`
  with `discoveryMaxDirs: 200`.
- **Agent frontmatter**: Add `kind: local` when rendering agents.
- **Experimental agents**: Subagents may require
  `experimental.enableAgents = true` in settings.

### Codex

- **TOML config**: Only CLI using TOML for its main config.
- **HTTP-only MCP**: Cannot use stdio MCP servers. Only `context7` (HTTP)
  survives filtering.
- **Merged prompts dir**: Commands and agents share `~/.codex/prompts/`.
  Agents use `agent-{name}.md` prefix convention.
- **Permission rules**: Uses `prefix_rule()` syntax in `rules/default.rules`.
  Not managed by this sync (Codex-only manual config).
- **No native subagents**: "Spawn a subagent" in prompts is executed inline
  by the model. No Task tool equivalent.
- **Model**: Uses GPT models (not Claude). `model = "gpt-5.2-codex"`.
- **No GSD**: GSD is not installed for Codex. No `gsd-*` files to worry about.

---

## 4. Secret Management

### Secret Variables

| Variable | Used By | Notes |
|----------|---------|-------|
| `TAVILY_API_KEY` | tavily MCP | In `env` block |
| `CONTEXT7_API_KEY` | context7 MCP | In `headers` block |
| `UPTIMIZE_BEDROCK_API_KEY` | OpenCode settings | In `provider.uptimize-bedrock.options.apiKey` |
| `PALANTIR_FOUNDRY_TOKEN` | palantir-mcp | Aliased as `FOUNDRY_TOKEN` in env block |

### Secret Alias

The palantir-mcp canonical definition uses `FOUNDRY_TOKEN` as the env key
but the actual secret is stored as `PALANTIR_FOUNDRY_TOKEN` in `.env`.
The canonical value `${PALANTIR_FOUNDRY_TOKEN}` maps to env key `FOUNDRY_TOKEN`.

### Path Expansion

Canonical settings files use `~` for home directory paths (e.g.,
`~/.claude/cacert.pem`, `~/Repos/acsync/AGENTS.md`). These must be
expanded/collapsed at the push/pull boundary:

- **Push**: Expand `~` to the actual home directory (`$HOME`).
- **Pull**: Collapse the home directory back to `~`.

### Push Direction (Repo to System)

Replace all `${VAR_NAME}` placeholders with real values from `.env`.
Expand all `~` paths to absolute paths.
Validate that all required vars are present and non-empty before writing.

### Pull Direction (System to Repo)

Replace all real secret values with `${VAR_NAME}` placeholders.
Collapse absolute home directory paths to `~`.
Scan for exact string matches of secret values in file content.
Also handle the `FOUNDRY_TOKEN` alias: if a file contains the real value
of `PALANTIR_FOUNDRY_TOKEN` under the key `FOUNDRY_TOKEN`, replace the
value with `${PALANTIR_FOUNDRY_TOKEN}`.

### OpenCode Provider Secrets

OpenCode provider configs use `{env:VAR_NAME}` syntax, not `${VAR}`.
These are NOT secret placeholders — they are runtime env var references
that OpenCode resolves at startup. Do NOT replace them during push/pull.
Leave `{env:ANTHROPIC_BASE_URL}` and `{env:ANTHROPIC_AUTH_TOKEN}` as-is.

### Validation

Before any push operation:
1. Load `.env` from repo root.
2. Verify all 4 secret vars are present and non-empty.
3. For each canonical MCP server with `env_vars`, verify the referenced
   vars exist in `.env`.
4. If any are missing, stop and list what's needed.

### Golden Rule

**Never commit real secret values to the repo.** After every pull, verify
the committed files contain only `${VAR}` placeholders, never actual values.

---

## 5. Subset Merge Rules

"Subset merge" means: read the system file, modify only the declared managed
keys, and write back — preserving all user/tool-managed keys untouched.

### Claude `~/.claude.json`

**Managed keys**: `mcpServers`

Everything else is user-owned: `projects`, `autoUpdates`,
`gitCommitBehavior`, feature flags, model cost tracking. Do NOT touch.

**Push**: Read system file. Replace `mcpServers` value with rendered MCP
(secrets injected). Write back.

**Pull**: Read system file. Extract `mcpServers` value. Redact secrets.
Compare to canonical MCP definitions.

### Claude `~/.claude/settings.json`

**Canonical source**: `configs/settings/claude.json`

**Managed keys**: `permissions`, `env`

**Unmanaged keys** (preserve during sync): `$schema`,
`alwaysThinkingEnabled`, `feedbackSurveyState`, `hooks`, `statusLine`
(last two are GSD-owned).

**Deep-merge keys**: `permissions`
The `permissions.allow` and `permissions.deny` arrays are merged:
canonical entries overwrite matching entries, user-added entries
(e.g., machine-local `Read()` rules) survive. During pull, entries
present in the system but not in canonical are flagged as user-added.

**Wholesale-replace keys**: `env`

**Path expansion**: Canonical uses `~` in paths (e.g.,
`~/.claude/cacert.pem`). Push expands `~` to the actual home
directory. Pull collapses the home directory back to `~`.

**Push**: Read system file. For `env`, replace value entirely (with `~`
expanded). For `permissions`, deep-merge canonical into existing. Write
back. Preserve all unmanaged keys.

**Pull**: Read system file. Extract managed keys. Collapse home
directory paths to `~`. Compare to canonical settings file.

### OpenCode `~/.config/opencode/opencode.json`

**Canonical source**: `configs/settings/opencode.json`

**Managed keys**: `provider`, `plugin`, `permission`, `model`,
`instructions`

Note: `mcp` is also a managed key but is handled separately by MCP
sync (section 2.5), not by settings sync. Do not duplicate MCP
handling here.

**Deep-merge keys** (within managed): `permission`
User-added entries survive; canonical entries overwrite matching keys.
This preserves custom tool permissions while syncing canonical ones.

**Wholesale-replace keys** (within managed): `provider`, `plugin`,
`model`, `instructions`.

**Unmanaged keys** (preserve during sync): `$schema`, and any
user-added keys not listed above.

**Secret handling**: The `provider.uptimize-bedrock.options.apiKey`
value uses `${UPTIMIZE_BEDROCK_API_KEY}` in canonical. Push injects
the real value from `.env`. Pull redacts it back to the placeholder.
The `uptimize-foundry` provider uses `{env:...}` syntax — these are
OpenCode runtime env var references, NOT secret placeholders. Leave
them as-is during push and pull.

**Path expansion**: Canonical uses `~` in `instructions` paths. Push
expands `~` to the actual home directory. Pull collapses it back.

**Push**: Read system file. For wholesale keys, replace value entirely
(with secrets injected and `~` expanded). For deep-merge keys, merge
canonical into existing (canonical wins on conflict, user extras
preserved). Write back.

**Pull**: Read system file. Extract managed keys. Redact secrets.
Collapse home directory paths to `~`. Compare to canonical settings
file.

### Gemini `~/.gemini/settings.json`

**Managed keys**: `mcpServers`

Everything else is user-owned: `security`, `context`, `tools`, `theme`.

Same push/pull pattern as Claude `~/.claude.json`.

### Codex `~/.codex/config.toml`

**MCP sections**: `[mcp_servers.*]` TOML sections at end of file.

**Push**: Read system file. Remove all existing `[mcp_servers.*]` sections.
Append rendered MCP TOML sections. Write back. Non-MCP sections are
preserved verbatim.

**Pull**: Read system file. Extract `[mcp_servers.*]` sections. Redact
secrets. Compare to canonical MCP definitions.


