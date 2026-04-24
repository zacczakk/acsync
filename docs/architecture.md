---
summary: Domain map of the agents repo — modules, layers, dependency direction.
read_when:
  - First time navigating repo structure
  - Adding new config targets or scripts
---

# Architecture

## Layers

- **configs/** — Canonical source for all CLI artifacts.
  - `commands/` — Slash commands (8 .md files)
  - `agents/` — Subagent definitions (2 .md files)
  - `skills/` — Skill bundles (38 directories)
  - `plugins/` — OpenCode plugins (4 .ts files, identity-rendered)
  - `mcp/` — MCP server definitions (7 .json files)
  - `settings/` — Per-CLI settings (4 .json files)
  - `hooks/` — Hook scripts (see [Hooks](#hooks) below)
  - `instructions/AGENTS.md` — Unified agent operating system (ground truth)
  - `instructions/TOOLS.md` — Tool-use reference
- **scripts/** — Helper tools on PATH (committer, ask-model, sessions, docs-list.ts, sync-upstream-skills.ts)
- **bin/** — Compiled binaries on PATH (6 MCP CLI binaries, docs-list)
- **docs/** — Operational documentation, plans, design decisions
- **backups/** — Pre-sync backups (gitignored)

## Data Flow

```
configs/  ──→  metronome push  ──→  ~/.claude/
                                                         ~/.config/opencode/
                                                         ~/.gemini/
                                                         ~/.codex/
```

## Dependency Direction

- CLI configs depend on `configs/` (never the reverse)
- `src/adapters/` implement per-CLI format transforms (spec: `docs/design/sync-spec.md`)
- `configs/instructions/AGENTS.md` is consumed by all CLIs at runtime (injected as instructions)
- `scripts/` are standalone; no imports between them
- `bin/` contains Bun-compiled binaries; both `scripts/` and `bin/` are on PATH

## Hooks

Hook scripts live in `configs/hooks/` and are referenced by absolute path from each CLI's hook registration. The scripts themselves are not copied by `metronome push`; only per-CLI hook registrations are synced where supported.

### Why absolute paths, not deployment

- Edits take effect immediately — no sync step needed.
- Hook config structures differ per CLI (Claude Code uses nested JSON, OpenCode uses plugin events).
- Only a handful of hooks; full deployment infra isn't warranted.

### Claude Code hooks

Registered in `~/.claude/settings.json` under the `hooks` key. Canonical source: `configs/settings/claude.json`. Metronome's deep-merge preserves any user-added hooks alongside managed ones.

| Script | Event | Managed by | Purpose |
|--------|-------|------------|---------|
| `vault-context-loader.js` | `SessionStart` | metronome | Injects IDENTITY/SOUL/USER/MEMORY into context |
| `rtk-rewrite.sh` | `PreToolUse` (Bash) | rtk init | Rewrites bash commands to `rtk` equivalents for token compression |

Hook scripts receive JSON on stdin (session_id, source, cwd, etc.) and communicate via exit codes + stdout JSON. See [Claude Code hooks reference](https://docs.anthropic.com/en/docs/claude-code/hooks).

### OpenCode plugins

OpenCode uses a **plugin system** instead of shell hooks. Local plugins are auto-loaded from `~/.config/opencode/plugins/`. See [OpenCode plugins docs](https://opencode.ai/docs/plugins/).

Plugin source files live in `configs/plugins/` and are **deployed by `metronome push`** to `~/.config/opencode/plugins/`. Only the OpenCode adapter supports plugins (`plugins: true`).

| Plugin | Event(s) | Purpose |
|--------|----------|---------|
| `notify-opencode.ts` | `session.created`, `session.deleted`, `session.status`, `permission.asked`, `question.asked`, `session.error` | macOS alerter notifications with iTerm2 pane focus. Tracks root sessions via `session.created`/`deleted`; uses `session.status` busy→idle transitions (not `session.idle`) to avoid duplicate notifications. Idle notifications are transient (5s). Retry status surfaces retries. Permission, question, and error notifications fire for all sessions. |
| `memory-vault-advisor.ts` | `tool.execute.after` | Advisory reminder to check Memory vault before exploratory searches (grep, glob, task/explore, tavily_search, context7). Output mutation doesn't propagate for MCP tools — known OpenCode limitation. |
| `rtk.ts` | `tool.execute.before` | Rewrites bash/shell commands to `rtk` equivalents for token compression. Delegates to `rtk rewrite` binary. Vendored from `rtk init -g --opencode` output. |
| `caveman-opencode.ts` | `session.created`, `command.execute.before` | Handles the real `/caveman` slash command in OpenCode, persists `~/.config/opencode/.caveman-active`, and on every new root session re-injects the active caveman reminder via the documented session SDK so persisted mode survives across sessions. |

Plugins are raw `.ts` files — identity-rendered (no frontmatter, no transformation). The `"plugin"` key in `opencode.json` (npm packages) is separately managed via settings wholesale-replace.

`caveman` uses a mixed command/runtime model across CLIs. Canonical behavior lives in `configs/skills/caveman/SKILL.md` and `configs/settings/caveman.json`. Claude Code and Codex use managed/native lifecycle hooks from `configs/hooks/`; OpenCode uses a real slash command from `configs/commands/caveman.md` plus the local auto-loaded plugin `configs/plugins/caveman-opencode.ts`. `caveman-opencode` is intentionally not listed in `opencode.json` `plugin[]` because that array is for npm plugins, while local plugins auto-load from `~/.config/opencode/plugins/`.

**Cursor OAuth (npm)**: Canonical `opencode.json` includes `opencode-cursor-oauth`
in the `plugin` array and a minimal `provider.cursor` entry (`name: "Cursor"`).
Together these enable Cursor-backed models in OpenCode after OAuth completes.
Source of truth: `configs/settings/opencode.json` (synced to
`~/.config/opencode/opencode.json` on push).

### Codex hooks

Codex supports native lifecycle hooks via `~/.codex/hooks.json` behind the `features.codex_hooks = true` flag in `~/.codex/config.toml`. Metronome manages both the TOML feature flag and the hook registration file for Codex.

| Script | Event | Managed by | Purpose |
|--------|-------|------------|---------|
| `vault-context-loader-codex.js` | `SessionStart` (`startup|resume`) | metronome | Injects IDENTITY/SOUL/USER/MEMORY into Codex startup context |

Canonical Codex hook registrations live in `configs/hook-configs/`. Hook scripts still live in `configs/hooks/` and run directly from the repo checkout via absolute path references in `hooks.json`.

### Adding a new hook

1. Create the script in `configs/hooks/`.
2. **Claude Code:** Add registration entry to `~/.claude/settings.json` → `hooks` key. Use absolute path to `configs/hooks/`.
3. **OpenCode:** Create a plugin `.ts` file in `configs/plugins/`. Run `metronome push --type plugins` to deploy. Reference shared logic from `configs/hooks/` if possible.
4. **Codex:** Add canonical registration to `configs/hook-configs/codex.json`. Ensure Codex settings enable `features.codex_hooks = true`.
5. Restart the CLI session for hooks to take effect.

## Test Isolation

E2E tests never touch real target directories (`~/.claude`, `~/.config/opencode`, etc.). Instead, `AdapterPathResolver` accepts an optional `homeDir` that redirects all path resolution to an isolated temp directory. Each test creates its own fake home via `createTestHome()` and passes it as `homeDir` to `runPush`/`runPull`/`runCheck`. This makes parallel execution safe by construction — no backup/restore, no locking, no race conditions.
