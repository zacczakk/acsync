---
phase: 06-flatten-canonical-structure
plan: 02
subsystem: infra
tags: [path-constants, readme, refactor, gap-closure]

# Dependency graph
requires:
  - phase: 06-flatten-canonical-structure
    plan: 01
    provides: Flat configs/ structure and path constants in canonical.ts
provides:
  - Zero stale configs/common/ references anywhere in repo
  - All CLI modules (render, pull, check) import path constants from canonical.ts
  - Single source of truth pattern fully wired
affects: [07-unify-instructions, 08-tools-repo-rename]

# Tech tracking
tech-stack:
  added: []
  patterns: [dir-map-for-dynamic-path-lookup]

key-files:
  created: []
  modified:
    - README.md
    - src/cli/render.ts
    - src/cli/pull.ts
    - src/cli/check.ts

key-decisions:
  - "render.ts: DIR_MAP lookup for dynamic dirName instead of switch — cleaner than forcing static constant into parameterized function"

patterns-established:
  - "DIR_MAP pattern: { commands: COMMANDS_DIR, agents: AGENTS_DIR } for mapping string keys to imported constants"

requirements-completed: [STRUCT-02]

# Metrics
duration: 14min
completed: 2026-02-24
---

# Phase 6 Plan 02: Gap Closure Summary

**Eliminated all stale configs/common/ references from README and wired COMMANDS_DIR/AGENTS_DIR/SKILLS_DIR constants into render.ts, pull.ts, check.ts**

## Performance

- **Duration:** 14 min
- **Started:** 2026-02-24T12:16:40Z
- **Completed:** 2026-02-24T12:30:57Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- README.md: 3 stale configs/common/ paths fixed + directory layout updated with instructions/ entry
- pull.ts: 9 hardcoded `join(projectDir, 'configs', ...)` replaced with COMMANDS_DIR/AGENTS_DIR/SKILLS_DIR + 2 stale description strings fixed
- check.ts: 2 hardcoded sourcePath joins replaced with COMMANDS_DIR/AGENTS_DIR
- render.ts: DIR_MAP pattern for dynamic dirName lookup using imported constants
- All 414 tests pass with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix README.md stale configs/common/ references** - `cda11fc` (fix)
2. **Task 2: Wire path constants into render.ts, pull.ts, check.ts** - `1aae32e` (refactor)

## Files Created/Modified
- `README.md` - Updated 3 setup instruction paths + directory layout section (added instructions/*.md)
- `src/cli/render.ts` - Import COMMANDS_DIR/AGENTS_DIR, DIR_MAP for readSingleCanonicalItem
- `src/cli/pull.ts` - Import COMMANDS_DIR/AGENTS_DIR/SKILLS_DIR, replace 9 hardcoded joins + fix 2 description strings
- `src/cli/check.ts` - Import COMMANDS_DIR/AGENTS_DIR, replace 2 sourcePath joins

## Decisions Made
- render.ts uses DIR_MAP lookup (`{ commands: COMMANDS_DIR, agents: AGENTS_DIR }`) instead of switch statement — the function takes a typed `dirName` parameter, so a map is cleaner than forcing static imports into conditional branches

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed stale configs/common/ in pull command description**
- **Found during:** Task 1
- **Issue:** pull.ts `.description()` string had 2 stale "configs/common/" references in user-facing help text
- **Fix:** Updated both occurrences to "configs/"
- **Files modified:** src/cli/pull.ts
- **Verification:** grep confirms zero configs/common refs
- **Committed in:** cda11fc (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - stale path in help text)
**Impact on plan:** Essential for correctness — user-facing CLI help should reference correct paths. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 6 complete — all verification gaps from 06-VERIFICATION.md are closed
- Zero configs/common/ references remain anywhere
- All path constants from canonical.ts are imported by at least one consumer
- Ready for Phase 7 (Unify Instructions)

## Self-Check: PASSED

- FOUND: README.md
- FOUND: src/cli/render.ts
- FOUND: src/cli/pull.ts
- FOUND: src/cli/check.ts
- FOUND: commit cda11fc
- FOUND: commit 1aae32e

---
*Phase: 06-flatten-canonical-structure*
*Completed: 2026-02-24*
