---
phase: 07-unify-instructions
plan: 01
subsystem: instructions
tags: [acsync, instructions, rendering-pipeline, path-resolver]

requires:
  - phase: 06-flatten-canonical-structure
    provides: Canonical path constants and flattened config structure

provides:
  - Unified configs/instructions/AGENTS.md with CLI-Specific Notes section
  - Simplified readCanonicalInstructions (single-file, no target param)
  - Simplified renderInstructions (identity passthrough, no addendum concat)
  - Corrected output filenames for opencode/gemini/codex (AGENTS.md)

affects: [07-02-cleanup-tests, rendering-pipeline, config-sync]

tech-stack:
  added: []
  patterns: [single-file-instruction-passthrough]

key-files:
  created:
    - configs/instructions/AGENTS.md
  modified:
    - src/cli/canonical.ts
    - src/adapters/base.ts
    - src/adapters/path-resolver.ts
    - src/cli/check.ts
    - src/cli/push.ts
    - src/cli/render.ts
    - src/cli/diff.ts

key-decisions:
  - "Instruction source items named 'instructions' (singular) instead of 'AGENTS.md' to avoid confusion with the file itself"
  - "renderInstructions is pure identity passthrough — no format transformation needed since content is pre-unified"

patterns-established:
  - "Single canonical instruction file: configs/instructions/AGENTS.md with ## CLI-Specific Notes for per-CLI content"

requirements-completed: [INST-01, INST-02, INST-03, INST-04, INST-05, INST-06, INST-07, INST-08, INST-09, INST-10]

duration: 8min
completed: 2026-02-24
---

# Phase 7 Plan 1: Unify Instructions Summary

**Merged 4 per-CLI addendums into single configs/instructions/AGENTS.md and simplified entire rendering pipeline to single-file passthrough**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-24T13:04:52Z
- **Completed:** 2026-02-24T13:13:34Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Created unified configs/instructions/AGENTS.md with ## CLI-Specific Notes containing all 4 CLI addendums
- Simplified readCanonicalInstructions from (projectDir, target) -> {base, addendum} to (projectDir) -> string
- Simplified renderInstructions from 2-param concat to single-param identity passthrough
- Corrected path-resolver output filenames: AGENTS.md for opencode/gemini/codex (was OPENCODE.md/GEMINI.md/instructions.md)
- Updated all 4 CLI commands (check, push, render, diff) to use simplified API

## Task Commits

Each task was committed atomically:

1. **Task 1: Create unified AGENTS.md and simplify rendering functions** - `d154b6d` (feat)
2. **Task 2: Update path-resolver output filenames and all CLI callers** - `bb4af5a` (feat)

## Files Created/Modified
- `configs/instructions/AGENTS.md` - Unified instructions with ## CLI-Specific Notes section
- `src/cli/canonical.ts` - Simplified readCanonicalInstructions (single-file reader)
- `src/adapters/base.ts` - Simplified renderInstructions (identity passthrough)
- `src/adapters/path-resolver.ts` - Corrected output filenames for 3 targets
- `src/cli/check.ts` - Updated to single-content instruction flow
- `src/cli/push.ts` - Updated to single-content instruction flow
- `src/cli/render.ts` - Updated to single-content instruction flow
- `src/cli/diff.ts` - Updated to single-content instruction flow

## Decisions Made
- Instruction source items named 'instructions' instead of 'AGENTS.md' to avoid confusion with the file itself
- renderInstructions is pure identity passthrough — content is already complete in the unified file

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ready for Plan 02 (test updates and old addendum file cleanup)
- Tests still reference old 2-param signatures — Plan 02 handles this

## Self-Check: PASSED

---
*Phase: 07-unify-instructions*
*Completed: 2026-02-24*
