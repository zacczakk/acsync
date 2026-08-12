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
  - `plugins/` — metronome-managed OpenCode V1 plugins (3 .ts files, identity-rendered)
  - `opencode/v2/plugins/` — profile-owned native V2 plugins
  - `mcp/` — MCP server definitions (9 .json files)
  - `settings/` — Per-CLI settings (4 .json files)
  - `hooks/` — Hook scripts (see [Hooks](#hooks) below)
  - `instructions/AGENTS.md` — Unified agent operating system (ground truth)
  - `instructions/TOOLS.md` — Tool-use reference
- **scripts/** — Helper tools on PATH (committer, ask-model, sessions, sessions_opencode.py, docs-list.ts, sync-upstream-skills.ts)
- **bin/** — Compiled binaries on PATH (6 MCP CLI binaries, docs-list)
- **docs/** — Operational documentation, plans, design decisions
- **backups/** — Pre-sync backups (gitignored)

## Data Flow

```
configs/  ──→  metronome push  ──→  ~/.claude/
                                    ~/.config/opencode/
                                    ~/.gemini/antigravity-cli/
                                    ~/.codex/
```

## Dependency Direction

- CLI configs depend on `configs/` (never the reverse)
- `src/adapters/` implement per-CLI format transforms (spec: `docs/design/sync-spec.md`)
- `configs/instructions/AGENTS.md` is consumed by all CLIs at runtime (injected as instructions)
- `scripts/` are standalone; no imports between them
- `bin/` contains Bun-compiled binaries; both `scripts/` and `bin/` are on PATH. Repo helpers such as `docs-list` resolve caller-owned files from `process.cwd()`, not from Bun's compiled `/$bunfs` module path.

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
| context-mode plugin | `PreToolUse`, `PostToolUse`, `PreCompact`, `SessionStart` | context-mode marketplace | Tool-output sandboxing, session continuity, `ctx_*` MCP tools. Installed via `claude plugin install context-mode@context-mode --scope user`. Canonical: `enabledPlugins` in `configs/settings/claude.json`. |

Hook scripts receive JSON on stdin (session_id, source, cwd, etc.) and communicate via exit codes + stdout JSON. See [Claude Code hooks reference](https://docs.anthropic.com/en/docs/claude-code/hooks).

### OpenCode plugins

OpenCode uses a **plugin system** instead of shell hooks. Local plugins are auto-loaded from `~/.config/opencode/plugins/`. See [OpenCode plugins docs](https://opencode.ai/docs/plugins/).

V1 plugin source files live in `configs/plugins/` and are deployed by generic
V1 sync to `~/.config/opencode/plugins/`. The V2 adapter reports no generic
plugin capability: V2 plugin files are profile-owned and deployed only by
`metronome opencode use v2`.

| Plugin | Event(s) | Purpose |
|--------|----------|---------|
| `memory-vault-advisor.ts` | `tool.execute.after` | Advisory reminder to check Memory vault before exploratory searches. |
| `read-guard.ts` | `tool.execute.after`, `tool.execute.before` | Blocks edits to existing files that have not been read in the session. |
| `validate-commit.ts` | `tool.execute.before` | Enforces Conventional Commit messages for `git commit`. |

V1 plugins are raw `.ts` files — identity-rendered (no frontmatter, no
transformation). Stale cleanup only removes plugins recorded as
Metronome-owned in the manifest; third-party files are preserved. The `"plugin"`
key in V1 `opencode.json` is separately managed via settings sync.

#### V1/V2 compatibility profiles

`configs/settings/opencode.json` remains V1-shaped canonical semantic input.
`src/opencode/version-renderer.ts` emits either V1 or native V2 configuration,
including ordered permissions, provider/model migration, MCP nesting, and
agent-specific model variants. Per-agent `reasoningEffort` and `textVerbosity`
become actual model variants in V2 because V2 retains but does not apply agent
`request.body` overlays.

`metronome opencode use v1|v2` owns profile activation and persists the active
profile in `~/.config/opencode/migration-manifest.json`. Generic `check`,
`push`, `pull`, `render`, and `diff` operations resolve target `opencode` from
that manifest; missing or invalid manifests select V1. `opencode2` forces V2,
uses the same paths, is excluded from `ALL_TARGETS`, and cannot be combined
with `opencode` in one operation.

The switcher backs up `opencode.json`, agents, both global plugin roots, CLI
settings, package manifests, and lockfiles before writing. Unknown plugins and
Tux's V1 `provider.tux` overlay are preserved. Native `providers` wins in V2,
so Tux may continue writing its V1 integration without breaking the active V2
catalog.

Versioned V2 plugins live under `configs/opencode/v2/plugins/`. V2 ports the
instruction loader, Memory advisor, read guard, commit validator, and Muxy
notifications. The Muxy V2 port is global; Muxy's app-owned ancestor plugin is
preserved because the app continuously regenerates it. Current Muxy releases
still emit a V1 plugin load warning under V2, but the global port remains the
active notification integration. Cursor OAuth is disabled in V2 because the
public V2 catalog API cannot add a provider; context-mode is disabled because
its package still exports the V1 `{ id, server }` contract. Switching back to
V1 restores the remembered Cursor symlink target and V1 plugin files.

The canonical settings file includes `./chatgpt-websearch` and
`websearch.provider: chatgpt`. V2 retains both; V2 runtime verification requires
`opencode.chatgpt-websearch`. V1 rendering omits this V2-only integration.

Generic V2 sync handles settings, agents, MCP, commands, skills, and
instructions. V2 preserves but does not natively resolve the config
`instructions` array; `metronome.instructions-loader` reads the four separate
Memory files and adds them through the supported session context hook.
`AGENTS.md` remains excluded from that plugin because V2 discovers it natively.

**Cursor OAuth (local fork, NOT npm, NOT metronome-copied)**: Cursor-backed
models in OpenCode are served by a maintained fork at
[`github.com/zacczakk/opencode-cursor`](https://github.com/zacczakk/opencode-cursor)
(cloned to `~/Repos/zacczakk/opencode-cursor`, upstream
`ephraimduncan/opencode-cursor`). It's a **built multi-file bundle** (a direct
gRPC→OpenAI proxy that talks straight to `api2.cursor.sh`), so it does **not**
fit metronome's single-`.ts`-file plugin model and is **not** in
`configs/plugins/`. Deploy: `bun run build` in the fork, then symlink
`dist/plugin.js` → `~/.config/opencode/plugins/cursor-oauth.js`. OpenCode
auto-discovers it from that directory. It self-injects a static
`@ai-sdk/openai-compatible` provider (display name "Cursor") via the `config`
hook — so it is deliberately **absent from `opencode.json`'s `plugin[]` array**
(a bare-name entry there would npm-resolve and double-load, which caused an
EADDRINUSE port conflict). Auth borrows Cursor's OAuth tokens from the macOS
Keychain (`cursor-agent login`). The fork remains the source of truth. Profile
switching only disables/restores its symlink because the implementation is V1-only.

**Context Mode (npm)**: Canonical V1 `opencode.json` includes `context-mode` in the `plugin` array. It is intentionally omitted from V2 until upstream ships a native `{ id, setup }` implementation or a separately tested rewrite exists. The MCP server remains independently managed through `configs/mcp/context-mode.json`. Installed globally via `bun add -g context-mode`. ELv2 license (personal/internal use: fine).

### Codex hooks

Codex supports native lifecycle hooks via `~/.codex/hooks.json` behind the `features.hooks = true` flag in `~/.codex/config.toml`. Metronome manages the TOML feature flag and only hook groups marked with `_managed: "metronome"`; third-party groups in `hooks.json` are preserved and ignored during drift checks.

| Script | Event | Managed by | Purpose |
|--------|-------|------------|---------|
| `vault-context-loader-codex.js` | `SessionStart` (`startup|resume`) | metronome | Injects IDENTITY/SOUL/USER/MEMORY into Codex startup context |

Canonical Codex hook registrations live in `configs/hook-configs/` and must carry the Metronome ownership marker. Hook scripts still live in `configs/hooks/` and run directly from the repo checkout via absolute path references in `hooks.json`.

### Codex provider profiles

`configs/settings/codex.json` may define a Metronome-only `profile_files` map.
The Codex adapter omits that key from `config.toml` and projects each entry to
`~/.codex/<name>.config.toml`, matching Codex 0.134+ profile layering. Select one
with `codex --profile <name>` or `codex exec --profile <name> ...`.

The base configuration remains ChatGPT Enterprise-authenticated. The `tux`
profile selects the local Tux provider without forwarding OpenAI credentials.

### Adding a new hook

1. Create the script in `configs/hooks/`.
2. **Claude Code:** Add registration entry to `~/.claude/settings.json` → `hooks` key. Use absolute path to `configs/hooks/`.
3. **OpenCode V1:** Create a plugin `.ts` file in `configs/plugins/` and run
   `metronome push --type plugins` to deploy. For V2, add a native plugin under
   `configs/opencode/v2/plugins/` and activate it with `metronome opencode use v2`.
   Reference shared logic from `configs/hooks/` if possible.
4. **Codex:** Add canonical registration to `configs/hook-configs/codex.json`. Ensure Codex settings enable `features.hooks = true`.
5. Restart the CLI session for hooks to take effect.

## Test Isolation

E2E tests never touch real target directories (`~/.claude`, `~/.config/opencode`, etc.). Instead, `AdapterPathResolver` accepts an optional `homeDir` that redirects all path resolution to an isolated temp directory. Each test creates its own fake home via `createTestHome()` and passes it as `homeDir` to `runPush`/`runPull`/`runCheck`. This makes parallel execution safe by construction — no backup/restore, no locking, no race conditions.
