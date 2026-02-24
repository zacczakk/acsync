---
phase: 07-unify-instructions
plan: 02
subsystem: instructions
tags: [acsync, instructions, tests, cleanup]

requires:
  - phase: 07-unify-instructions
    provides: Unified AGENTS.md and simplified single-param renderInstructions

provides:
  - Tests updated for single-param renderInstructions and single-file readCanonicalInstructions
  - Clean configs/instructions/ directory with only AGENTS.md
  - No repo-root AGENTS.md (canonical location is configs/instructions/AGENTS.md)

affects: [config-sync, rendering-pipeline]

tech-stack:
  added: []
  patterns: [identity-passthrough-testing]

key-files:
  created: []
  modified:
    - src/adapters/__tests__/instructions.test.ts
    - src/cli/__tests__/render.test.ts
    - src/cli/__tests__/orchestrator.test.ts

key-decisions:
  - "check.test.ts unchanged — only tests CLI helpers, no instruction-specific logic"

patterns-established:
  - "Identity passthrough test pattern: input === output for renderInstructions"

requirements-completed: [INST-01, INST-02, INST-03, INST-04]

duration: 2min
completed: 2026-02-24
---

# Phase 7 Plan 2: Test Updates and Addendum Cleanup Summary

**Updated 3 test files for single-param renderInstructions, deleted 4 addendum files and repo-root AGENTS.md, full suite 402/402 green**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-24T13:18:40Z
- **Completed:** 2026-02-24T13:20:55Z
- **Tasks:** 2
- **Files modified:** 8 (3 test files updated, 5 files deleted)

## Accomplishments
- Simplified instructions.test.ts from 5 two-param tests to 2 identity passthrough tests per adapter
- Updated render.test.ts and orchestrator.test.ts for single-param API
- Deleted 4 per-CLI addendum files (claude.md, opencode.md, gemini.md, codex.md)
- Deleted repo-root AGENTS.md — canonical location is now configs/instructions/AGENTS.md
- Full test suite passes: 402 tests, 0 failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Update all test files for new instruction signatures** - `2e6636a` (test)
2. **Task 2: Delete addendum files, remove repo-root AGENTS.md** - `fca3839` (chore)

## Files Created/Modified
- `src/adapters/__tests__/instructions.test.ts` - Simplified to identity passthrough tests
- `src/cli/__tests__/render.test.ts` - Updated readCanonicalInstructions call (no target param)
- `src/cli/__tests__/orchestrator.test.ts` - setupProject writes unified AGENTS.md
- `configs/instructions/claude.md` - Deleted
- `configs/instructions/opencode.md` - Deleted
- `configs/instructions/gemini.md` - Deleted
- `configs/instructions/codex.md` - Deleted
- `AGENTS.md` - Deleted (was repo root)

## Decisions Made
- check.test.ts left unchanged — it only tests CLI helper functions (collect, mapTargets, mapTypes, validate*), no instruction-specific logic

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 07 complete — all 2 plans executed
- Instruction unification fully complete: single AGENTS.md, single-param API, all tests green
- Ready for Phase 08 (repo rename)

---
*Phase: 07-unify-instructions*
*Completed: 2026-02-24*

## Self-Check: PASSED
