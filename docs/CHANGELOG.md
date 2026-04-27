---
summary: Notable changes to the agents repo.
read_when:
  - Reviewing what changed between syncs
---

# Changelog

## v1.3.10 — 2026-04-27

- **Caveman mode rewrite** — slash-command-only activation, sticky for the current OpenCode session, in-memory only. Removed `.caveman-active` state files, SessionStart/UserPromptSubmit hooks for Claude/Codex, and shared lifecycle scripts. Slash command still renders to all 4 targets but only OpenCode's plugin acts on it
- **Codex settings + hooks sync** — added centrally managed Codex settings and hook configuration to the sync pipeline
- **Tux tool streaming fix** — disabled tool streaming for Tux models to prevent broken tool calls
- **Claude tool search** — enabled `ENABLE_TOOL_SEARCH` in managed Claude Code settings
- **Memory retrieval skill** — new skill for searching Memory vault and session history before broad repo search
- **Docs refresh** — updated browser and MCP guidance, marked caveman plan shipped, corrected OpenCode wiring notes

## v1.3.8 — 2026-04-20

- **Subagent workflow expansion** — added dedicated review/research/debug/docs/release/security/infra/verify agents plus subagent-driven planning and execution skills for tighter task handoff and review loops
- **Design tooling layer** — added design-context commands, `design-critique`, upgraded `frontend-design`, and shipped minimal design specs/plans for repeatable UI review and polish work
- **Skill and tooling refresh** — added release, git-worktree, system-debugging, TDD, verification, and writing-plan skills; expanded TOOLS/AGENTS guidance; added eval coverage and reporting for more agent flows
- **CLI and sync improvements** — added eval runner/reporting, `sessions` helper, `--json` support on `diff`, better non-TTY pull behavior, stronger validation/read-guard plugins, and updated MCP/settings sync behavior
- **MCP fixes** — default Tavily MCP to `provider_ENV=dev`, preserve disabled Claude MCP servers, and keep OpenCode MCP goldens aligned with current env output
- **Docs and repo refresh** — updated README/architecture/overview, added logo assets, improved release automation docs, and continued repo-wide canonical cleanup

## v1.3.7 — 2026-02-03

- **OpenCode Cursor OAuth** — documented `opencode-cursor-oauth` plugin + `cursor` provider in README, `docs/`, Memory vault, and Knowledge vault

## v1.3.6 — 2026-03-10

- **Notification hooks overhaul** — alerter v26.5 double-dash flag fix, Stop hook with first-line summary, click-to-pane teleport via iTerm2 AppleScript, async hooks, removed dead PermissionRequest hook
- **Hook-aware settings merge** — Claude adapter preserves user hooks during config sync
- **provider docs skill** — router-pattern skill with on-demand chapter loading for provider platform documentation
- **OpenCode notify plugin rewrite** — non-blocking alerter via Bun shell, double-load guard
- **Obsidian CLI permission** — added to bash allow list

## v1.3.5 — 2026-03-07

- **Session-notes skill enhancements** — expanded triggers, added dead-end template, added consolidated field
- **Compaction checkpoint hooks** — added hook documentation for compaction checkpoints

## v1.3.4 — 2026-03-05

- **Fix Gemini adapter** — use TOML literal strings (`'''`) instead of basic multiline (`"""`) to prevent backslash escape interpretation; add required `name` field to agent frontmatter; use `{{args}}` for Gemini argument interpolation
- **New obs-fix-links command** — repairs stale parent links in Memory vault notes
- **Obs command consolidation** — merged obs-jot + obs-lookup into obs-recap; renamed obs-add-note → obs-note, obs-triage-inbox → obs-triage
- **Tree-graph linking rules** — folder parent always first in `related:`, no body leaf-leaf wikilinks
- **Tooling docs** — added agent-browser native mode + bird CLI documentation

## v1.3.3 — 2026-03-05

- **Mandatory release checklist** — bump-version now enforces execution of `docs/RELEASE.md` steps before reporting success

## v1.3.2 — 2026-03-04

- **Updated bump-version command** — release notes template with structured format, user-facing language guidelines, and version comparison links

## v1.3.1 — 2026-03-04

- **Skill-scoped git push** — `bump-version` command gets its own Bash permission for `git push`

## v1.3.0 — 2026-03-04

- **Expanded managed settings** — manage 8 keys: `$schema`, `permissions`, `env`, `alwaysThinkingEnabled`, `cleanupPeriodDays`, `teammateMode`, `prefersReducedMotion`, `sandbox`
- **Hardened permissions** — replace `mcp__*` wildcard with per-server entries; deny `.env` reads, `git push`, `git restore`
- **Vault context hook** — `vault-context-loader.js` SessionStart hook injects persona/memory files as additional context
- **Skill-scoped git push** — `bump-version` skill gets its own Bash permission for `git push`
- Add `WebFetch`/`WebSearch` to allow list
- Add env vars for agent teams and 200k context cap
- Allow `/tmp` paths in OpenCode settings

## 2026-03-03

- **Fix phantom MCP drift** — `hashContent()` now normalizes trailing whitespace before hashing, preventing perpetual drift when external tools (e.g. Claude Code) rewrite config files without trailing newline
- Fix double-slash in `diff` path display (`--- a//Users/...` → `--- a/Users/...`)

## 2026-02-28

- **`metronome check` compact output** — only shows drifted items (create/update/delete) by default; `--verbose` to include up-to-date items
- **`metronome diff` rewrite** — interactive picker (TTY), `--name` filter, `--all` flag, extracted types/helpers
- `diff` now prints "No drift detected — nothing to diff." instead of silent exit
- `check` settings drift uses `renderSettings` for accurate comparison (fixes false-positive drift)
- Added `@inquirer/checkbox` dependency

## 2026-02-25

- **v3.0 Harden Test Suite shipped** — 12 phases, 32 plans complete
- Phase 12: Pull E2E tests — 24 pull cells (6 types × 4 targets) with golden comparison
- **Test isolation overhaul** — E2E tests no longer touch real `~/.claude`, `~/.config/opencode`, etc. Added `homeDir` param to `AdapterPathResolver` and threaded through all adapters, `createAdapter`, `runPush`, `runPull`, `runCheck`. Tests use isolated temp dirs via `createTestHome()`. Fixes parallel race condition that deleted real CLI configs. Suite dropped from ~28s to ~600ms.
- Added `metronome helpers -p <path>` subcommand — copies helper scripts to target repos
- Restored 4 disabled MCP server definitions (chrome-devtools-mcp, palantir-mcp, liquid-carbon, shadcn)
- Documentation groom: fixed 43 issues (stale refs, wrong counts, dead links)

## 2026-02-18

- Initial full sync push across all 4 CLIs (Claude, OpenCode, Gemini, Codex)
- Path migration: `.tasks/` → `docs/plans/`
- Added `groom-docs` command
- 96 files backed up, 97 files written
