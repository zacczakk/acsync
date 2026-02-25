---
phase: 11-push-e2e-tests
plan: 03
subsystem: testing
tags: [e2e, push, mcp, settings, instructions, golden-files, merge-testing]

requires:
  - phase: 11-01
    provides: "Seed fixtures, MCP/settings golden files, extended generate-golden.ts"
provides:
  - "E2E push tests for MCP across all 4 targets with merge golden comparison"
  - "E2E push tests for settings across claude + opencode with merge golden comparison"
  - "E2E push tests for instructions across all 4 targets with identity passthrough"
  - "Idempotency verification for all 3 config types"
  - "Stale MCP server removal verification"
affects: []

tech-stack:
  added: []
  patterns: ["withTargetBackup wrapping all assertions in single test to avoid backup/restore overhead"]

key-files:
  created:
    - src/cli/__tests__/push-mcp.test.ts
    - src/cli/__tests__/push-settings.test.ts
    - src/cli/__tests__/push-instructions.test.ts
  modified: []

key-decisions:
  - "Combined all MCP assertions into single test (golden, codex HTTP-only, stale removal, idempotency) to avoid repeated backup/restore cycles"
  - "Settings test confirms gemini/codex have settings capability disabled rather than checking for no file writes"

patterns-established:
  - "Single-test-per-type pattern: all assertions within one withTargetBackup call for E2E push tests"

requirements-completed: [PUSH-04, PUSH-05, PUSH-06, PUSH-07]

duration: 20min
completed: 2026-02-25
---

# Phase 11 Plan 03: MCP, Settings, and Instructions Push E2E Tests Summary

**Golden-file-based E2E push tests for MCP (4 targets with seed merge), settings (claude + opencode merge), and instructions (identity passthrough across 4 targets)**

## Performance

- **Duration:** 20 min
- **Started:** 2026-02-25T12:00:13Z
- **Completed:** 2026-02-25T12:21:10Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created push-mcp.test.ts covering all 4 targets with seed→push→golden comparison, codex HTTP-only filtering, non-canonical server removal, and idempotency
- Created push-settings.test.ts covering claude + opencode with seed merge, non-canonical key preservation, and gemini/codex settings-disabled verification
- Created push-instructions.test.ts covering all 4 targets with identity passthrough, content equality across all targets, and idempotency

## Task Commits

Each task was committed atomically:

1. **Task 1: Write push-mcp.test.ts E2E test** - `5db55e8` (feat)
2. **Task 2: Write push-settings.test.ts and push-instructions.test.ts** - `4504ce2` (feat)

## Files Created/Modified
- `src/cli/__tests__/push-mcp.test.ts` - E2E test for MCP push across 4 targets with merge golden comparison
- `src/cli/__tests__/push-settings.test.ts` - E2E test for settings push to claude + opencode with merge
- `src/cli/__tests__/push-instructions.test.ts` - E2E test for instructions push to all 4 targets with identity passthrough

## Decisions Made
- Combined all MCP assertions into single test block within one `withTargetBackup` call to avoid repeated 4-directory backup/restore overhead
- Settings test verifies gemini/codex have `settings: false` capability rather than checking no-op writes — clearer intent
- Instructions test verifies all 4 targets get identical content (identity passthrough property) rather than just comparing to golden

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 3 remaining config types (MCP, settings, instructions) now have E2E push coverage
- Combined with Plan 02 (commands, agents, skills), all push cells are covered
- Ready for phase completion

## Self-Check: PASSED

- All 3 created files exist on disk
- Both commits (5db55e8, 4504ce2) found in git log

---
*Phase: 11-push-e2e-tests*
*Completed: 2026-02-25*
