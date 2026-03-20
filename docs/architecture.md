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
  - `agents/` — Subagent definitions (currently empty)
  - `skills/` — Skill bundles (21 directories)
  - `mcp/` — MCP server definitions (7 .json files)
  - `settings/` — Per-CLI settings (claude, opencode)
  - `hooks/` — Hook scripts (see [Hooks](#hooks) below)
  - `instructions/AGENTS.md` — Unified agent operating system (ground truth)
  - `instructions/TOOLS.md` — Tool-use reference
- **scripts/** — Helper tools on PATH (committer, ask-model, docs-list.ts, browser-tools.ts)
- **bin/** — Compiled binaries on PATH (7 MCP CLI binaries, docs-list, browser-tools)
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

Hook scripts live in `configs/hooks/` but are **not deployed by `metronome push`**. They are referenced by absolute path from each CLI's settings and run directly from the repo checkout.

### Why absolute paths, not deployment

- Edits take effect immediately — no sync step needed.
- Hook config structures differ per CLI (Claude Code uses nested JSON, OpenCode uses plugin events).
- Only a handful of hooks; full deployment infra isn't warranted.

### Claude Code hooks

Registered in `~/.claude/settings.json` under the `hooks` key (a user extra preserved by metronome's deep-merge — not in canonical `configs/settings/claude.json`).

| Script | Event | Purpose |
|--------|-------|---------|
| `vault-context-loader.js` | `SessionStart` | Injects IDENTITY/SOUL/USER/MEMORY into context |

Hook scripts receive JSON on stdin (session_id, source, cwd, etc.) and communicate via exit codes + stdout JSON. See [Claude Code hooks reference](https://docs.anthropic.com/en/docs/claude-code/hooks).

### OpenCode plugins

OpenCode uses a **plugin system** instead of shell hooks. Local plugins are auto-loaded from `~/.config/opencode/plugins/`. See [OpenCode plugins docs](https://opencode.ai/docs/plugins/).

Plugin source files live in `configs/plugins/` and are **deployed by `metronome push`** to `~/.config/opencode/plugins/`. Only the OpenCode adapter supports plugins (`plugins: true`).

| Plugin | Event(s) | Purpose |
|--------|----------|---------|
| `notify-opencode.ts` | `session.created`, `session.deleted`, `session.idle`, `permission.asked`, `question.asked`, `session.error` | macOS alerter notifications with iTerm2 pane focus. Tracks root sessions via `session.created`/`deleted`; `session.idle` notifications only fire for root sessions (subagent idle suppressed). Permission, question, and error notifications fire for all sessions. |
| `memory-vault-advisor.ts` | `tool.execute.after` | Advisory reminder to check Memory vault before exploratory searches (grep, glob, task/explore, tavily_search, context7). Output mutation doesn't propagate for MCP tools — known OpenCode limitation. |

Plugins are raw `.ts` files — identity-rendered (no frontmatter, no transformation). The `"plugin"` key in `opencode.json` (npm packages) is separately managed via settings wholesale-replace.

**Cursor OAuth (npm)**: Canonical `opencode.json` includes `opencode-cursor-oauth`
in the `plugin` array and a minimal `provider.cursor` entry (`name: "Cursor"`).
Together these enable Cursor-backed models in OpenCode after OAuth completes.
Source of truth: `configs/settings/opencode.json` (synced to
`~/.config/opencode/opencode.json` on push).

### Adding a new hook

1. Create the script in `configs/hooks/`.
2. **Claude Code:** Add registration entry to `~/.claude/settings.json` → `hooks` key. Use absolute path to `configs/hooks/`.
3. **OpenCode:** Create a plugin `.ts` file in `configs/plugins/`. Run `metronome push --type plugins` to deploy. Reference shared logic from `configs/hooks/` if possible.
4. Restart the CLI session for hooks to take effect (Claude Code snapshots hooks at startup).

## Test Isolation

E2E tests never touch real target directories (`~/.claude`, `~/.config/opencode`, etc.). Instead, `AdapterPathResolver` accepts an optional `homeDir` that redirects all path resolution to an isolated temp directory. Each test creates its own fake home via `createTestHome()` and passes it as `homeDir` to `runPush`/`runPull`/`runCheck`. This makes parallel execution safe by construction — no backup/restore, no locking, no race conditions.
