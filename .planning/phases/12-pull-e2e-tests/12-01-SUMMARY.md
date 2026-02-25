---
phase: 12-pull-e2e-tests
plan: 01
subsystem: cli
tags: [pull, mcp, instructions, adapters, parseMCPServers]

requires:
  - phase: 11-push-e2e-tests
    provides: adapter renderMCPServers and push pipeline patterns
provides:
  - parseMCPServers reverse-parser on all 4 adapters
  - MCP server pull discovery and canonical JSON write
  - Instructions pull discovery and passthrough write
  - PullItem.type union extended with 'mcp' | 'instruction'
affects: [12-pull-e2e-tests]

tech-stack:
  added: []
  patterns: [parseMCPServers as reverse of renderMCPServers, identity passthrough for instructions pull]

key-files:
  created: []
  modified:
    - src/adapters/base.ts
    - src/adapters/opencode.ts
    - src/adapters/codex.ts
    - src/cli/pull.ts

key-decisions:
  - "parseMCPServers default in BaseAdapter handles JSON mcpServers key (Claude/Gemini inherit)"
  - "OpenCode override parses JSONC mcp key with env var transform via EnvVarTransformer.fromOpenCode"
  - "Codex override parses TOML mcp_servers (HTTP-only, bearer_token_env_var → Authorization header)"
  - "Instructions pull is identity passthrough — no transformation needed"

patterns-established:
  - "parseMCPServers: reverse of renderMCPServers — same adapter hierarchy pattern"

requirements-completed: [PULL-05, PULL-06]

duration: 6min
completed: 2026-02-25
---

# Phase 12 Plan 01: MCP & Instructions Pull Pipeline Summary

**parseMCPServers reverse-parser on all 4 adapters + MCP/instructions discovery and write wired into runPull**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-25T14:06:25Z
- **Completed:** 2026-02-25T14:12:51Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments
- Added `parseMCPServers(content)` to ToolAdapter interface with BaseAdapter default for JSON targets
- Implemented OpenCode override (JSONC, `mcp` key, env var transform) and Codex override (TOML, `mcp_servers`, HTTP-only)
- Extended PullItem type union with `'mcp' | 'instruction'`
- Wired MCP discovery + write pass into runPull (per-server canonical JSON output)
- Wired instructions discovery + write pass into runPull (identity passthrough)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add parseMCPServers to adapters + MCP/instructions pull to pull.ts** - `f6c4ca1` (feat)

## Files Created/Modified
- `src/adapters/base.ts` - Added parseMCPServers to ToolAdapter interface + BaseAdapter default implementation
- `src/adapters/opencode.ts` - Override parseMCPServers for JSONC mcp key with env var transform
- `src/adapters/codex.ts` - Override parseMCPServers for TOML mcp_servers (HTTP-only)
- `src/cli/pull.ts` - Extended PullItem type, added MCP + instructions discovery and write passes

## Decisions Made
- parseMCPServers default in BaseAdapter handles JSON `mcpServers` key — Claude and Gemini adapters inherit without override
- OpenCode override uses `readJsonc` for JSONC support and `EnvVarTransformer.fromOpenCode` for env var conversion
- Codex override reconstructs `Authorization: Bearer ${VAR}` from `bearer_token_env_var` TOML field
- Instructions pull uses identity passthrough — no transformation between target and canonical format

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing test failure (1 of 443): `runPullAll > items present in multiple targets appear under each source` — expects opencode skills dir at `~/.config/opencode/skill/` which doesn't exist on this machine. Not caused by this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Pull pipeline now handles all 6 config types (commands, agents, skills, settings, MCP, instructions)
- Ready for plan 12-02 (pull E2E test infrastructure)

## Self-Check: PASSED

- All key-files.modified exist on disk
- Commit f6c4ca1 found in git log

---
*Phase: 12-pull-e2e-tests*
*Completed: 2026-02-25*
