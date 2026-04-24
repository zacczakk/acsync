---
summary: "Reference spec for format transformations, MCP rendering, secret handling, and merge rules."
read_when:
  - "Modifying adapter rendering logic"
  - "Adding a new CLI target"
  - "Debugging format transformation or secret injection"
---

# Sync Specification (Reference)

> **Status**: Reference document. The sync logic is implemented in the
> `metronome` TypeScript CLI (`src/adapters/`, `src/secrets/`, `src/core/`).
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
| Codex | `~/.codex/prompts/*.md` | `~/.codex/agents/*.toml` | `~/.agents/skills/` |

Note the naming quirks: OpenCode uses singular `command/` and `skill/`. Codex
keeps slash commands in `prompts/`, but custom subagents now live in
`agents/`, and user-authored skills live in `$HOME/.agents/skills/`.

### Canonical Sources (This Repo)

```
configs/commands/*.md              14 slash commands
configs/agents/                    Agent definitions (OpenCode-style frontmatter)
configs/skills/                    38 skill directories
configs/mcp/*.json                 7 MCP server definitions
configs/settings/*.json            4 settings definitions (caveman, claude, codex, opencode)
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

#### OpenCode — Strip Canonical-Only Frontmatter Keys

OpenCode command rendering preserves frontmatter except for canonical-only keys.

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
---
```

Rules:
- Preserve standard frontmatter keys that OpenCode can carry through unchanged.
- Strip canonical-only keys `allowed-tools`, `argument-hint`, and `name` during render.
- Do not synthesize an OpenCode `tools:` map from canonical command frontmatter.
- Body content is passed through unchanged.

Note: OpenCode agent rendering is different; agents may emit target-specific metadata such as `mode: subagent`, but commands do not.

#### Gemini CLI — Convert to TOML

```toml
description = "Full CI gate..."
prompt = '''
# /gate -- Full CI Gate

[body content here]
'''
```

Rules:
- Extract `description` from frontmatter to a top-level TOML key.
- Strip frontmatter entirely from the body.
- Wrap body in `prompt = '''...'''` (triple-quoted TOML literal string).
- If `argument-hint` exists and body does not contain `{{args}}`, append
  `\nUser arguments: {{args}}` at end of prompt.

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

Canonical agent frontmatter (source of truth):
```yaml
---
description: Goal-backward task planning. Invoke after implementation.
mode: subagent
model: github-copilot/gpt-5.4
permission:
  bash: allow
  edit: deny
  webfetch: deny
color: '#a277ff'
---
```

Claude rendered agent frontmatter:
```yaml
---
name: planner
description: Goal-backward task planning. Invoke after implementation.
model: github-copilot/gpt-5.4
allowed-tools: [Read, Glob, Grep, Bash]
---
```

Rules:
- Derive `name` from filename.
- Keep `description` and `model` if present.
- Derive `allowed-tools` from OpenCode-style `permission`:
  - always include `Read`, `Glob`, `Grep`
  - include `Edit` and `Write` when `permission.edit != deny`
  - include `Bash` when `permission.bash != deny`
  - include `WebFetch` when `permission.webfetch != deny`
- Drop OpenCode-only keys like `mode`, `permission`, and `color`.
- Body content copied verbatim.

#### OpenCode — Pass Through Frontmatter, Force Subagent Mode

Canonical agent frontmatter:
```yaml
---
description: Goal-backward task planning...
mode: subagent
model: github-copilot/gpt-5.4
permission:
  bash: allow
  edit: deny
color: '#a277ff'
---
```

OpenCode rendered agent frontmatter:
```yaml
---
description: Goal-backward task planning...
mode: subagent
model: github-copilot/gpt-5.4
permission:
  bash: allow
  edit: deny
color: '#a277ff'
---
```

Rules:
- Add `mode: subagent` (always).
- Keep all OpenCode-compatible frontmatter except canonical command-only keys.
- Keep `model`, `description`, `permission`, `color`, and other supported fields.
- Body content passed through unchanged.

#### Gemini CLI — Add `kind: local`

Canonical agent frontmatter:
```yaml
---
description: Goal-backward task planning...
mode: subagent
model: github-copilot/gpt-5.4
permission:
  bash: allow
  edit: deny
---
```

Gemini rendered agent frontmatter:
```yaml
---
name: planner
description: Goal-backward task planning...
model: github-copilot/gpt-5.4
allowed-tools: [Read, Glob, Grep, Bash]
kind: local
---
```

Rules:
- Derive `name` from filename.
- Keep `description` and `model` if present.
- Derive `allowed-tools` from `permission` using the Claude rules above.
- Add `kind: local` to frontmatter.
- Drop OpenCode-only keys like `mode`, `permission`, and `color`.

#### Codex — Standalone TOML in `agents/{name}.toml`

```toml
name = "planner"
description = "Goal-backward task planning..."
developer_instructions = "# Planner Agent\n\n[body content here]"
sandbox_mode = "read-only"
```

Rules:
- Filename: `agents/{name}.toml`
- Required keys: `name`, `description`, `developer_instructions`
- `developer_instructions` receives the body content with frontmatter stripped.
- Preserve Codex-native keys when present in canonical metadata:
  `nickname_candidates`, `model` (when already Codex-compatible),
  `model_reasoning_effort`, `sandbox_mode`, `mcp_servers`, `skills`.
- If canonical metadata explicitly denies edits and no `sandbox_mode` is set,
  derive `sandbox_mode = "read-only"` to preserve read-only intent.
- Reverse parsing accepts both the current TOML format and legacy
  `prompts/agent-*.md` markdown for backward compatibility during migration.

### 2.3 Skills

Skills are directory trees (e.g., `vercel-react-best-practices/SKILL.md`).
Copy them verbatim to all four CLIs' skill directories. No format
transformation needed. For Codex, user-authored skills are written to
`$HOME/.agents/skills/`; legacy `~/.codex/skills/` remains readable during
migration but is not the write target.

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
  "disabled_for": ["cli"],      // optional, per-CLI exclusion
  "target_options": {           // optional, target-specific render extras
    "claude-code": {"disabled": true},
    "opencode": {"timeout": 20000}
  }
}
```

**Filtering**: Before rendering for a CLI, exclude any server where the CLI
name appears in `disabled_for`. Exception: skill-MCP force-enable (see 2.3).

**Target options**: `target_options` is the escape hatch for target-specific
fields that the shared canonical schema does not model directly. Use it
sparingly for adapter quirks where exact config shape matters.

#### Claude Code Format

```json
{
  "server-name": {
    "type": "stdio",
    "command": "tavily-mcp",
    "args": [],
    "env": {
      "TAVILY_API_KEY": "actual-secret-value",
      "provider_ENV": "dev"
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
- Drop `description`, `env_vars`, `transport`, `disabled_for`, `target_options`.
- Keep `command`, `args`, `env` (stdio) or `url`, `headers` (http).
- Default disabled rendering uses `enabled: false`; target-specific
  `target_options` may override this for exact compatibility with an
  external owner such as Tux.
- Inject real secret values (replace `${VAR}` with values from `.env`).

#### OpenCode Format

```json
{
  "server-name": {
    "type": "local",
    "command": ["tavily-mcp"],
    "environment": {
      "TAVILY_API_KEY": "actual-secret-value",
      "provider_ENV": "dev"
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
  (e.g., `"command": ["tavily-mcp"]`).
  If `args` is empty, still use an array: `"command": ["shadcn"]`.
- Rename `"env"` to `"environment"`.
- Add `"enabled": true` (or `false` if canonical has `"enabled": false`).
- Drop `description`, `env_vars`, `transport`, `disabled_for`.
- Inject real secret values.

#### Gemini CLI Format

```json
{
  "server-name": {
    "command": "tavily-mcp",
    "args": [],
    "env": {
      "TAVILY_API_KEY": "actual-secret-value",
      "provider_ENV": "dev"
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

#### Codex Format (TOML)

```toml
[mcp_servers.tavily]
command = "python"
args = [ "-m", "tavily_mcp" ]
env_vars = [ "TAVILY_API_KEY" ]

[mcp_servers.tavily.env]
TAVILY_API_KEY = "${TAVILY_API_KEY}"

[mcp_servers.context7]
url = "https://mcp.context7.com/mcp"

[mcp_servers.context7.env_http_headers]
CONTEXT7_API_KEY = "CONTEXT7_API_KEY"
```

Rules:
- Section header: `[mcp_servers.{name}]`.
- Support both stdio (`command`, `args`, `env`, `env_vars`) and HTTP (`url`, `http_headers`, `env_http_headers`, `bearer_token_env_var`).
- Rename canonical env-backed HTTP header values like `"X-Token": "${TOKEN}"` to `env_http_headers.X-Token = "TOKEN"`.
- Rename canonical `Authorization: "Bearer ${TOKEN}"` to `bearer_token_env_var = "TOKEN"`.
- Keep `enabled = false` when a server is disabled but still managed.
- Drop `description`, `transport`, `disabled_for`.
- Append these sections to the end of `~/.codex/config.toml`.

---

## 3. Per-CLI Specialties

### Claude Code

- **WebFetch is blocked** by network proxy. All web lookups must use the
  Tavily MCP server (`tavily-mcp`). The `CLAUDE.md` addendum in the
  system dir enforces this.
- **SSL certificates**: `settings.json` injects `SSL_CERT_FILE` and
  `NODE_EXTRA_CA_CERTS` pointing to `~/.claude/cacert.pem`. Canonical uses
  `~` paths; push expands `~` to the actual home directory.
- **Hooks**: `settings.json` hook entries are managed during sync, including
  caveman lifecycle hooks. Preserve user-owned project-level MCP state in
  `~/.claude.json`.
- **Project-level MCP**: `~/.claude.json` has per-project
  `enabledMcpjsonServers`/`disabledMcpjsonServers` entries. Do NOT modify
  these during sync.
- **Claude-only skills**: The `ralph-tui-*` skills in `~/.claude/skills/` are
  Claude-only. They are not canonical (not in `configs/skills/`). Do
  NOT remove them during sync.

### OpenCode

- **Custom providers**: network proxy providers (`provider-bedrock`,
  `provider-foundry`) plus a **`cursor`** stub (paired with the
  `opencode-cursor-oauth` npm plugin) for Cursor subscription access. Limits
  and models for corporate providers live in the `provider` key of
  `opencode.json`.
- **Env var syntax**: OpenCode uses `{env:VAR_NAME}` template syntax in
  provider configs (distinct from `${VAR}` used elsewhere).
- **Naming quirks**: `command/` (singular), `skill/` (singular),
  `environment` (not `env`), `local`/`remote` (not `stdio`/`http`),
  `command` as array (not string + args).
- **Deep-merge keys**: `permission` and `tools` in `opencode.json` use deep
  merge (user-added entries survive). All other managed keys use wholesale
  replacement.
- **Plugin system**: npm plugins in `opencode.json.plugin[]` are managed from
  canonical `configs/settings/opencode.json`. Preserve user-added entries via
  deep merge.
- **Local plugins**: files in `~/.config/opencode/plugins/` auto-load without `opencode.json` registration. Canonical local plugins are deployed from `configs/plugins/` via `metronome push --type plugins`; do not add them to the npm `plugin[]` list unless they are actual packages.
- **Command tool limits**: canonical `allowed-tools` is stripped during
  OpenCode render. Metronome does not synthesize an OpenCode frontmatter
  `tools` map from canonical command metadata.

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
- **MCP transports**: Supports both stdio and HTTP MCP servers in
  `config.toml`.
- **Split command/agent layout**: Commands stay in `~/.codex/prompts/`.
  Custom subagents now live in `~/.codex/agents/*.toml`.
- **User skills dir**: User-authored skills live in `~/.agents/skills/`.
  Legacy `~/.codex/skills/` may still exist locally but is not canonical.
- **Settings capability**: Codex settings are managed via `~/.codex/config.toml`.
  Metronome currently syncs canonical TOML settings from `configs/settings/codex.json`
  and Codex hook registration from `configs/hook-configs/codex.json` to
  `~/.codex/hooks.json`.
- **Hooks**: Native lifecycle hooks live in `~/.codex/hooks.json` and require
  `features.codex_hooks = true`. Metronome manages both the feature flag and
  the hook registration file for Codex.
- **Permission rules**: Uses `prefix_rule()` syntax in `rules/default.rules`.
  Not managed by this sync (Codex-only manual config).
- **Native subagents**: Built-in `default`, `worker`, and `explorer`
  subagents are available, and custom agents can override per-agent sandbox,
  model, MCP, and skill config in TOML files.
- **Model**: Uses GPT models (not Claude). Recent migrations move old
  `gpt-5.x-codex` aliases toward `gpt-5.4`.
- **No GSD**: GSD is not installed for Codex. No `gsd-*` files to worry about.

### Caveman Mode

- Canonical skill: `configs/skills/caveman/SKILL.md`
- Canonical config: `configs/settings/caveman.json`
- Canonical command: `configs/commands/caveman.md`
- Shared runtime helper: `configs/hooks/caveman-shared.js`
- Claude wiring: `configs/hooks/caveman-sessionstart-claude.js`, `configs/hooks/caveman-userprompt-claude.js`, plus managed hook registration in `configs/settings/claude.json`
- Codex wiring: `configs/hooks/caveman-sessionstart-codex.js`, `configs/hooks/caveman-userprompt-codex.js`, plus `configs/hook-configs/codex.json`
- OpenCode wiring: `configs/plugins/caveman-opencode.ts` deployed as a local auto-loaded plugin, handling `command.execute.before` for `/caveman` and `session.created` for startup recovery; plus the real slash command in `configs/commands/caveman.md`
- OpenCode note: `caveman-opencode` is a local plugin artifact, not an npm plugin entry in `opencode.json` `plugin[]`

---

## 4. Secret Management

### Secret Variables

| Variable | Used By | Notes |
|----------|---------|-------|
| `TAVILY_API_KEY` | tavily MCP | In `env` block |
| `provider_ENV` | tavily MCP | Set to `dev` for this key |
| `CONTEXT7_API_KEY` | context7 MCP | In `headers` block |
| `provider_OPENAI_API_KEY_PROD` | OpenCode settings | Runtime `{env:...}` reference in provider options |

### Path Expansion

Canonical settings files use `~` for home directory paths (e.g.,
`~/.claude/cacert.pem`, `~/Repos/zacczakk/metronome/AGENTS.md`). These must be
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

### OpenCode Provider Secrets

OpenCode provider configs use `{env:VAR_NAME}` syntax, not `${VAR}`.
These are NOT secret placeholders — they are runtime env var references
that OpenCode resolves at startup. Do NOT replace them during push/pull.

### Tux-Managed Palantir MCP

`palantir-mcp` is modeled canonically as the thin `tux palantir-mcp start`
launcher. Metronome does not manage Foundry host/token env wiring for this
server; Tux resolves that at runtime from its own config and keychain-backed
auth state. Keep the editor config launcher-only so `tux integrate ...` and
`metronome push` converge on the same shape.
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

**Managed keys**: `$schema`, `permissions`, `env`,
`alwaysThinkingEnabled`, `cleanupPeriodDays`, `teammateMode`,
`prefersReducedMotion`, `sandbox`

**Unmanaged keys** (preserve during sync): `feedbackSurveyState`,
`hooks`, `statusLine` (last two are GSD-owned).

**Deep-merge keys**: `permissions`
The `permissions.allow` and `permissions.deny` arrays are merged:
canonical entries overwrite matching entries, user-added entries
(e.g., machine-local `Read()` rules) survive. During pull, entries
present in the system but not in canonical are flagged as user-added.

**Wholesale-replace keys**: `env`, `$schema`, `alwaysThinkingEnabled`,
`cleanupPeriodDays`, `teammateMode`, `prefersReducedMotion`, `sandbox`

**Path expansion**: Canonical uses `~` in paths (e.g.,
`~/.claude/cacert.pem`). Push expands `~` to the actual home
directory. Pull collapses the home directory back to `~`.

**Push**: Read system file. For `env` and other wholesale-replace keys,
replace value entirely (with `~` expanded where applicable). For
`permissions`, deep-merge canonical into existing. Write back. Preserve
all unmanaged keys.

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

**Secret handling**: OpenCode provider configs use runtime `{env:VAR_NAME}`
references in canonical settings (for example `provider_OPENAI_API_KEY_PROD`,
`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`). These are not metronome secret
placeholders. Leave them as-is during push and pull.

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

**Managed keys**: `mcpServers`, `mcp.excluded`

Everything else is user-owned: `security`, `context`, `tools`, `theme`.

Same push/pull pattern as Claude `~/.claude.json`.

**HTTP MCP transport**: Gemini CLI uses `httpUrl` for streamable HTTP MCP
servers. Plain `url` is reserved for SSE MCP servers.

**Disable state**: metronome renders disabled canonical Gemini MCP servers in
`mcp.excluded`. Gemini CLI's own `gemini mcp disable` command also persists
disablement in `~/.gemini/mcp-server-enablement.json`, so pull logic needs to
honor both sources.

### Codex `~/.codex/config.toml`

**MCP sections**: `[mcp_servers.*]` TOML sections at end of file.

**Push**: Read system file. Remove all existing `[mcp_servers.*]` sections.
Append rendered MCP TOML sections. Write back. Non-MCP sections are
preserved verbatim.

**Pull**: Read system file. Extract `[mcp_servers.*]` sections. Redact
secrets. Compare to canonical MCP definitions.
