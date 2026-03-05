---
summary: Notable changes to the agents repo.
read_when:
  - Reviewing what changed between syncs
---

# Changelog

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

- **`acsync check` compact output** — only shows drifted items (create/update/delete) by default; `--verbose` to include up-to-date items
- **`acsync diff` rewrite** — interactive picker (TTY), `--name` filter, `--all` flag, extracted types/helpers
- `diff` now prints "No drift detected — nothing to diff." instead of silent exit
- `check` settings drift uses `renderSettings` for accurate comparison (fixes false-positive drift)
- Added `@inquirer/checkbox` dependency

## 2026-02-25

- **v3.0 Harden Test Suite shipped** — 12 phases, 32 plans complete
- Phase 12: Pull E2E tests — 24 pull cells (6 types × 4 targets) with golden comparison
- **Test isolation overhaul** — E2E tests no longer touch real `~/.claude`, `~/.config/opencode`, etc. Added `homeDir` param to `AdapterPathResolver` and threaded through all adapters, `createAdapter`, `runPush`, `runPull`, `runCheck`. Tests use isolated temp dirs via `createTestHome()`. Fixes parallel race condition that deleted real CLI configs. Suite dropped from ~28s to ~600ms.
- Added `acsync helpers -p <path>` subcommand — copies helper scripts to target repos
- Restored 4 disabled MCP server definitions (chrome-devtools-mcp, palantir-mcp, liquid-carbon, shadcn)
- Documentation groom: fixed 43 issues (stale refs, wrong counts, dead links)

## 2026-02-18

- Initial full sync push across all 4 CLIs (Claude, OpenCode, Gemini, Codex)
- Path migration: `.tasks/` → `docs/plans/`
- Added `groom-docs` command
- 96 files backed up, 97 files written
