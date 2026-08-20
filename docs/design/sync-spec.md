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
| OpenCode V1 | `~/.config/opencode/opencode.json` | JSON | `mcp` | `provider`, `plugin`, `permission`, `model`, `instructions` |
| OpenCode V2 | `~/.config/opencode/opencode.json` | JSON | `mcp.servers` | `providers`, `plugins`, `permissions`, `agents`, `model`, `instructions`, `websearch` |
| Antigravity | `~/.gemini/antigravity-cli/settings.json` | JSON | `mcpServers` | n/a |
| Codex | `~/.codex/config.toml` | TOML | `[mcp_servers.*]` sections | n/a |

### Managed Directories (Wholesale Copy/Render)

| CLI | Commands | Agents | Skills |
|-----|----------|--------|--------|
| Claude | `~/.claude/commands/*.md` | `~/.claude/agents/*.md` | `~/.claude/skills/` |
| OpenCode | `~/.config/opencode/commands/*.md` | `~/.config/opencode/agents/*.md` | `~/.agents/skills/` |
| Antigravity | `~/.gemini/commands/*.toml` | `~/.gemini/antigravity-cli/skills/*.md` | `~/.gemini/antigravity-cli/skills/` |
| Codex | `~/.codex/prompts/*.md` | `~/.codex/agents/*.toml` | `~/.agents/skills/` |

OpenCode and Codex share user-authored skills through `~/.agents/skills/`. Codex
keeps slash commands in `prompts/`, but custom subagents now live in
`agents/`, and user-authored skills live in `$HOME/.agents/skills/`.

### Canonical Sources (This Repo)

```
configs/commands/*.md              14 slash commands
configs/agents/                    Agent definitions (OpenCode-style frontmatter)
configs/skills/                    38 skill directories
configs/mcp/*.json                 8 MCP server definitions
configs/settings/*.json            3 settings definitions (claude, codex, opencode)
configs/instructions/AGENTS.md     Unified agent operating system
configs/instructions/TOOLS.md      Tool-use reference
configs/opencode/v2/plugins/       Native V2 profile-owned plugins
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

#### Antigravity CLI — Convert to TOML

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

For the native V2 profile, Metronome additionally converts `permission` to
ordered `permissions`, renames `bash` to `shell`, and moves provider request
options into a generated `agent-<name>` model variant. Do not render agent
`request.body`: current V2 retains that object but does not apply it.

#### Antigravity CLI — Add `kind: local`

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

Antigravity rendered agent frontmatter (written to `~/.gemini/antigravity-cli/skills/`):
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
  `model_reasoning_effort`, `model_verbosity`, `sandbox_mode`, `mcp_servers`, `skills`.
- Translate OpenCode-style GPT options for Codex: `reasoningEffort` ->
  `model_reasoning_effort`; `textVerbosity` -> `model_verbosity`.
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
| OpenCode | `~/.config/opencode/AGENTS.md` | Auto-discovered by filename |
| Antigravity | `~/.gemini/antigravity-cli/AGENTS.md` | Auto-discovered by filename |
| Codex | `~/.codex/AGENTS.md` | Auto-discovered by filename |

#### Push

1. Read `configs/instructions/AGENTS.md`.
2. Write content verbatim to the CLI's instruction file.

No secret injection needed (these files contain no secrets).

Generic V2 sync still writes `AGENTS.md` as the instruction item. OpenCode V2
does not natively resolve the config `instructions` array, so the V2 profile
preserves separate Memory files through the versioned
`metronome.instructions-loader` plugin and its `session.context` hook rather
than concatenating those files into `AGENTS.md`.

### 2.4.1 OpenCode Version Switching

- Canonical OpenCode settings remain V1-shaped.
- `metronome opencode use v1` writes V1 config, agents, MCP, and plugins.
- `metronome opencode use v2` writes native V2 equivalents and V2 plugins.
- Generic V2 sync handles settings, agents, MCP, commands, skills, and
  instructions. V2 plugin sync is intentionally a no-op because those files
  are profile-owned.
- `metronome opencode use v1|v2` persists the active profile in
  `~/.config/opencode/migration-manifest.json`; `metronome opencode status`
  reports it. This is separate from the top-level `metronome status` drift
  alias.
- Generic `check`, `push`, `pull`, `render`, and `diff` operations resolve
  target `opencode` from that manifest and default to V1 when it is absent or
  invalid.
- `opencode2` forces native V2 for scripts and CI, shares paths with `opencode`,
  is not in `ALL_TARGETS`, and cannot be combined with `opencode`.
- Preserve unowned plugin files and Tux's V1 overlay.
- Canonical settings include `./chatgpt-websearch` and
  `websearch.provider: chatgpt`. V2 retains both and runtime verification
  requires `opencode.chatgpt-websearch`; `metronome.muxy-notify` is optional
  and never blocks activation. V1 rendering omits these V2-only integrations.
- Deploy the native V2 Muxy port as
  `~/.config/opencode/plugins/metronome-muxy-notify.js`; preserve Muxy's
  app-owned `muxy-notify.js` because Muxy regenerates it.
- Record every switch and all output hashes in
  `~/.config/opencode/migration-manifest.json`.
- Backups live below `~/.config/opencode-backups/metronome/`.
- Ordinary V2 activation waits for the hot-reloaded plugin catalog without
  restarting the shared service; `update-v2` restarts it after an SDK/CLI
  update.
- Failed `update-v2` activation restores and re-verifies the previous exact
  global CLI build. The updater does not activate a beta-channel result older
  than the current build, retains the current build, and repairs
  package/launcher mismatches with a clean exact install.

For a Bun installation, update V2 only through:

```sh
metronome opencode update-v2
```

Equivalent manual flow: `bun install -g --force --trust --minimum-release-age=0
@opencode-ai/cli@beta`, resolve the installed exact build with `bun pm ls -g`,
confirm it matches `opencode2 --version`, install the same exact
`@opencode-ai/plugin` build with an explicit `--minimum-release-age=0` override
in `~/.config/opencode`, restart `opencode2 service`, then verify
`opencode2 api get /api/plugin`. A missing Muxy ID is a warning; the other
required IDs must be present.

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
  "headers": {"KEY": "VALUE"},  // http only; ${VAR} placeholders are canonical
  "env_vars": ["VAR"],          // validation only — not rendered
  "env": {"KEY": "${VAR}"},     // runtime env vars — stdio only
  "enabled": true|false,        // optional, default true
  "disabled_for": ["cli"],      // optional, per-CLI exclusion
  "target_options": {           // optional, target-specific render extras
    "claude-code": {"disabled": true},
    "opencode": {"oauth": false},
    "opencode2": {"oauth": false, "codemode": true}
  }
}
```

**Filtering**: Before rendering for a CLI, exclude any server where the CLI
name appears in `disabled_for`. Exception: skill-MCP force-enable (see 2.3).

**Target options**: `target_options` is the escape hatch for target-specific
fields that the shared canonical schema does not model directly. Use it
sparingly for adapter quirks where exact config shape matters.

The managed GitHub MCP (`configs/mcp/github.json`) uses an
`Authorization: Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}` header. OpenCode V1
disables OAuth for it; OpenCode V2 also enables `codemode`.

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

#### OpenCode V1 Format

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
- Convert `${VAR}` references in `environment` and `headers` to OpenCode's
  `{env:VAR}` runtime references; pull reverses this conversion.
- Copy `target_options.opencode` into the server entry.

#### OpenCode V2 Format

```json
{
  "mcp": {
    "servers": {
      "server-name": {
        "type": "local",
        "command": ["tavily-mcp"],
        "environment": {
          "TAVILY_API_KEY": "actual-secret-value"
        },
        "disabled": false,
        "timeout": { "catalog": 20000, "execution": 20000 }
      }
    }
  }
}
```

Rules:
- Nest servers under `mcp.servers`.
- Use the same `local`/`remote` and command-array conventions as V1.
- Render canonical `enabled: false` as `disabled: true` (and enabled servers
  as `disabled: false`).
- A numeric target timeout becomes both `timeout.catalog` and
  `timeout.execution`.
- Apply `disabled_for` using the `opencode2` target identity.
- Use `target_options.opencode2` for V2-only MCP render options; V1 options
  remain under `target_options.opencode`.
- Convert `${VAR}` references in `environment` and `headers` to OpenCode's
  `{env:VAR}` runtime references; pull reverses this conversion.
- Copy `target_options.opencode2` into the server entry.

**OpenCode pull**: Remote server `headers` are parsed back into the canonical
schema. Recognized `oauth` and `codemode` fields are stored under
`target_options` for the active target (`opencode` or `opencode2`).

#### Antigravity CLI Format

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
- **Hooks**: `settings.json` hook entries are managed during sync. Preserve user-owned project-level MCP state in
  `~/.claude.json`.
- **Project-level MCP**: `~/.claude.json` has per-project
  `enabledMcpjsonServers`/`disabledMcpjsonServers` entries. Do NOT modify
  these during sync.
- **Claude-only skills**: The `ralph-tui-*` skills in `~/.claude/skills/` are
  Claude-only. They are not canonical (not in `configs/skills/`). Do
  NOT remove them during sync.

### OpenCode

- **Profiles**: `opencode` follows the active profile in
  `~/.config/opencode/migration-manifest.json` (invalid or missing means V1).
  `opencode2` forces native V2 for scripts and CI. Both target names share
  `~/.config/opencode/`, cannot be combined, and only `opencode` is in the
  default all-target set.
- **Custom providers**: network proxy providers (`provider-bedrock`,
  `provider-foundry`) and Tux's V1 overlay are authored under `provider` and
  rendered under `providers` in V2. Preserve unrelated provider entries.
- **Env var syntax**: OpenCode uses `{env:VAR_NAME}` template syntax in
  provider configs (distinct from `${VAR}` used elsewhere).
- **Naming quirks**: `command/` (singular), `skill/` (singular),
  `environment` (not `env`), `local`/`remote` (not `stdio`/`http`),
  `command` as array (not string + args).
- **V1/V2 settings**: V1 uses `provider`, `plugin`, `permission`, and flat
  `mcp`; V2 uses `providers`, `plugins`, ordered `permissions`, and nested
  `mcp.servers`.
- **ChatGPT websearch**: Canonical settings include `./chatgpt-websearch` and
  `websearch.provider: chatgpt`. V2 retains them and runtime verification
  requires `opencode.chatgpt-websearch`; V1 rendering omits this V2-only
  integration.
- **Plugin ownership**: Generic V1 sync deploys `configs/plugins/`. V2 plugin
  files under `configs/opencode/v2/plugins/` are profile-owned and deployed by
  `metronome opencode use v2`; generic V2 plugin sync does nothing.
- **Command tool limits**: canonical `allowed-tools` is stripped during
  OpenCode render. Metronome does not synthesize an OpenCode frontmatter
  `tools` map from canonical command metadata.

### Antigravity CLI (`agy`)

- **Commands in TOML**: Only CLI that uses TOML for slash commands (`~/.gemini/commands/*.toml`).
- **Agents as skills**: Agents are written to `~/.gemini/antigravity-cli/skills/` (not a separate `agents/` dir).
- **No MCP type field**: MCP entries have no `type` key.
- **Config root**: `~/.gemini/antigravity-cli/` (settings, agents/skills, instructions); commands stay at `~/.gemini/commands/`.
- **Agent frontmatter**: Add `kind: local` when rendering agents.

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
  `features.hooks = true`. Metronome manages the feature flag and hook groups
  marked with `_managed: "metronome"`; unmarked third-party groups are preserved.
- **Permission rules**: Uses `prefix_rule()` syntax in `rules/default.rules`.
  Not managed by this sync (Codex-only manual config).
- **Native subagents**: Built-in `default`, `worker`, and `explorer`
  subagents are available, and custom agents can override per-agent sandbox,
  model, MCP, and skill config in TOML files.
- **Model**: Uses GPT models (not Claude). Recent migrations move old
  `gpt-5.x-codex` aliases toward `gpt-5.4`.
- **No GSD**: GSD is not installed for Codex. No `gsd-*` files to worry about.

---

## 4. Secret Management

### Secret Variables

| Variable | Used By | Notes |
|----------|---------|-------|
| `TAVILY_API_KEY` | tavily MCP | In `env` block |
| `provider_ENV` | tavily MCP | Set to `dev` for this key |
| `CONTEXT7_API_KEY` | context7 MCP | In `headers` block |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | github MCP | `Authorization` header; OpenCode renders `{env:GITHUB_PERSONAL_ACCESS_TOKEN}` |
| `provider_OPENAI_API_KEY_PROD` | OpenCode settings | Runtime `{env:...}` reference in provider options |

### Path Expansion

Canonical settings files use `~` for home directory paths (e.g.,
`~/.claude/cacert.pem`, `~/Repos/zacczakk/metronome/AGENTS.md`). These must be
expanded/collapsed at the push/pull boundary:

- **Push**: Expand `~` to the actual home directory (`$HOME`).
- **Pull**: Collapse the home directory back to `~`.

### Push Direction (Repo to System)

Replace all `${VAR_NAME}` placeholders with real values from `.env`, except
OpenCode MCP `environment` and `headers`, which use `{env:VAR_NAME}` runtime
references instead of inline values.
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
2. Verify all required secret vars are present and non-empty.
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

**Canonical source**: `configs/settings/opencode.json` (V1-shaped).

Generic target `opencode` resolves the active profile from
`~/.config/opencode/migration-manifest.json`; an invalid or missing manifest
selects V1. Target `opencode2` always selects V2. Both targets share this file
and cannot be combined; only `opencode` is in `ALL_TARGETS`.

**V1 managed keys**: `provider`, `plugin`, `permission`, `model`,
`instructions`. The canonical `./chatgpt-websearch` plugin entry and
`websearch.provider: chatgpt` are omitted by the V1 renderer.

**V2 managed keys**: `providers`, `plugins`, `permissions`, `agents`, `model`,
`instructions`, `websearch`. V2 retains the canonical ChatGPT websearch
settings; runtime verification requires `opencode.chatgpt-websearch`.

Note: `mcp` is also a managed key but is handled separately by MCP sync
(section 2.5), not by settings sync. Do not duplicate MCP handling here.

V1 permission settings are deep-merged so user-added entries survive. Other
V1 managed settings are rendered into their V1 keys. V2 converts canonical
permissions, providers/models, agents, and plugins to native shapes; existing
provider and external plugin entries are preserved where the renderer merges
them. Unknown top-level keys remain user-owned.

The canonical OpenCode permission policy allows recursive access to
`~/.config/opencode/*` and `~/.agents/**`. On macOS, temporary-directory rules
include both `/var/folders/**` and the canonical `/private/var/folders/**`
spelling; OpenCode2 matches the canonical path emitted by filesystem tools.

V2 plugin files under `configs/opencode/v2/plugins/` are profile-owned and are
not deployed by generic V2 plugin sync. Activate them with
`metronome opencode use v2`.

**Secret handling**: OpenCode provider configs use runtime `{env:VAR_NAME}`
references in canonical settings (for example `provider_OPENAI_API_KEY_PROD`,
`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`). These are not metronome secret
placeholders. Leave them as-is during push and pull.

**Push/pull**: Read or write the active profile's rendered keys while
preserving unmanaged top-level state. Generic `pull -s opencode` follows the
same profile resolution; `pull -s opencode2` reads native V2 shapes.

### Antigravity `~/.gemini/antigravity-cli/settings.json`

**Managed keys**: `mcpServers`, `mcp.excluded`

Everything else is user-owned: `security`, `context`, `tools`, `theme`.

Same push/pull pattern as Claude `~/.claude.json`.

**HTTP MCP transport**: Antigravity CLI uses `httpUrl` for streamable HTTP MCP
servers. Plain `url` is reserved for SSE MCP servers.

**Disable state**: metronome renders disabled canonical Antigravity MCP servers in
`mcp.excluded`. The `agy` CLI's own disable command also persists disablement
in `~/.gemini/antigravity-cli/mcp-server-enablement.json`, so pull logic needs
to honor both sources.

### Codex `~/.codex/config.toml`

**MCP sections**: `[mcp_servers.*]` TOML sections at end of file.

**Push**: Read system file. Remove all existing `[mcp_servers.*]` sections.
Append rendered MCP TOML sections. Write back. Non-MCP sections are
preserved verbatim.

**Pull**: Read system file. Extract `[mcp_servers.*]` sections. Redact
secrets. Compare to canonical MCP definitions.
