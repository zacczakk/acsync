---
summary: Notable changes to the agents repo.
read_when:
  - Reviewing what changed between syncs
---

# Changelog

## 2026-08-10

- Added atomic `metronome opencode use v1|v2` compatibility profiles with complete backups and an append-only migration manifest.
- Generic OpenCode sync now follows the persisted profile; explicit `opencode2` forces V2, shares paths with `opencode`, is excluded from default all-target sync, and cannot be combined with it.
- Added native V2 ports for separate instruction loading, Memory advice, read guarding, Conventional Commit validation, and Muxy notifications; V2 plugin files remain profile-owned.
- Canonical OpenCode settings now include ChatGPT websearch for V2, with runtime verification for `opencode.chatgpt-websearch`; V1 rendering omits the V2-only integration.
- Added durable Bun V2 update and exact plugin-SDK alignment through `metronome opencode update-v2`.

## Unreleased

- **OpenCode context pricing** — added legacy long-context costs for Tux's
  OpenAI models and translated them into native V2 tiers at the OpenAI 272K
  boundary.
- **OpenCode profile diagnostics** — timed profile-switch stages now go to
  stderr, plugin readiness retries report missing IDs, and redundant exact SDK
  installs are skipped; corrected docs to distinguish `use v2` hot reload from
  `update-v2` service restart
- **OpenCode V2 update diagnostics** — `update-v2` now reports global CLI
  resolution/install, profile activation, service restart, verification, and
  exact global rollback stages
- **OpenCode V2 update hardening** — refuse to activate beta-channel
  downgrades, retain the current build, repair package/launcher version drift,
  treat Muxy readiness as optional, and deploy the native Muxy port under a
  filename Muxy cannot overwrite
- **Sessions CLI clarity** — added `sessions latest`, documented `opencode2` as
  the OpenCode V2 source, and hint when a source name is passed as `--project`
- **OpenCode V2 sessions** — extended `sessions` list/read/export/search/stats and FTS indexing to the native V2 database at `~/.local/share/opencode-v2/opencode/opencode.db`; `opencode2` is available as an explicit source and included in default flows when present
- **GitHub MCP** — added a canonical PAT-authenticated remote definition; OpenCode V1/V2 render its `${VAR}` Authorization placeholder as `{env:VAR}`, disable OAuth, enable V2 `codemode`, and round-trip headers and target options on pull
- **Skill portfolio reduction** — removed eleven overlapping workflow skills, blocked them from upstream resync, and replaced Superpowers debugging/TDD with manually synced Matt Pocock `diagnosing-bugs` and `tdd`
- **Claude palantir MCP allowlist** — added `mcp__palantir-mcp` to managed Claude Code always-allowed tools
- **Claude context-mode MCP allowlist** — added `mcp__context-mode` to managed Claude Code always-allowed tools
- **Claude maestro MCP allowlist** — added `mcp__maestro-mcp` to managed Claude Code always-allowed tools
- **docs-list compiled binary fix** — resolve `docs/` from the caller's current repo instead of Bun's virtual `/$bunfs` path; added compiled-binary regression coverage
- **Caveman removal** — removed the caveman skill, slash command, OpenCode plugin, fixtures, and docs wiring

## v1.3.10 — 2026-04-27

- **Caveman mode rewrite** — slash-command-only activation, sticky for the current OpenCode session, in-memory only. Removed `.caveman-active` state files, SessionStart/UserPromptSubmit hooks for Claude/Codex, and shared lifecycle scripts. Slash command still renders to all 4 targets but only OpenCode's plugin acts on it
- **Codex settings + hooks sync** — added centrally managed Codex settings and hook configuration to the sync pipeline
- **Tux compatibility fix** — aligned tool settings for Tux models
- **Claude tool search** — enabled `ENABLE_TOOL_SEARCH` in managed Claude Code settings
- **Memory retrieval skill** — new skill for searching Memory vault and session history before broad repo search
- **Docs refresh** — updated browser and MCP guidance, marked caveman plan shipped, corrected OpenCode wiring notes

## v1.3.8 — 2026-04-20

- **Subagent workflow expansion** — added dedicated review/research/debug/docs/release/security/infra/verify agents plus subagent-driven planning and execution skills for tighter task handoff and review loops
- **Design tooling layer** — added design-context commands, `design-critique`, upgraded `frontend-design`, and shipped minimal design specs/plans for repeatable UI review and polish work
- **Skill and tooling refresh** — added release, git-worktree, system-debugging, TDD, verification, and writing-plan skills; expanded TOOLS/AGENTS guidance; added eval coverage and reporting for more agent flows
- **CLI and sync improvements** — added eval runner/reporting, `sessions` helper, `--json` support on `diff`, better non-TTY pull behavior, stronger validation/read-guard plugins, and updated MCP/settings sync behavior
- **MCP fixes** — preserve disabled Claude MCP servers and keep OpenCode MCP goldens aligned with current env output
- **Docs and repo refresh** — updated README/architecture/overview, added logo assets, improved release automation docs, and continued repo-wide canonical cleanup

## v1.3.7 — 2026-02-03

- **OpenCode Cursor OAuth** — documented `opencode-cursor-oauth` plugin + `cursor` provider in README, `docs/`, Memory vault, and Knowledge vault

## v1.3.6 — 2026-03-10

- **Notification hooks overhaul** — alerter v26.5 double-dash flag fix, Stop hook with first-line summary, click-to-pane teleport via iTerm2 AppleScript, async hooks, removed dead PermissionRequest hook
- **Hook-aware settings merge** — Claude adapter preserves user hooks during config sync
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
