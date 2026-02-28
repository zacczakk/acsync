---
summary: Notable changes to the agents repo.
read_when:
  - Reviewing what changed between syncs
---

# Changelog

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
