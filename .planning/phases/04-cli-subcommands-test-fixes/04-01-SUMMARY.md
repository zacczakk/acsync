---
phase: 04-cli-subcommands-test-fixes
plan: 01
subsystem: cli
tags: [commander, render, diff, unified-diff, lcs]

requires:
  - phase: 03-diff-engine-cli
    provides: orchestrator with runCheck, createAdapter, canonical readers
provides:
  - render subcommand (--type, --name, --target)
  - diff subcommand (unified text diff output)
  - --json flag on check and push commands
affects: [05-dead-code-cleanup]

tech-stack:
  added: []
  patterns: [exported orchestrator internals for subcommand reuse, LCS-based unified diff]

key-files:
  created:
    - src/cli/render.ts
    - src/cli/diff.ts
    - src/cli/__tests__/render.test.ts
    - src/cli/__tests__/diff.test.ts
  modified:
    - src/cli/index.ts
    - src/cli/orchestrator.ts
    - src/cli/check.ts
    - src/cli/push.ts

key-decisions:
  - "Exported createAdapter + read* functions from orchestrator rather than reimplementing"
  - "Implemented LCS-based unified diff instead of adding diff npm package"
  - "Greedy LCS fallback for files >1M line-pairs to avoid O(n^2) memory"

patterns-established:
  - "Subcommands import orchestrator internals directly (no intermediate abstraction layer)"

requirements-completed: [CLI-01, CLI-02, CLI-05]

duration: 15min
completed: 2026-02-21
---

# Phase 4 Plan 1: Render + Diff Subcommands Summary

**Render subcommand with --type/--name/--target, unified diff subcommand with LCS algorithm, and --json flag on check/push**

## Performance

- **Duration:** 15 min
- **Started:** 2026-02-21T22:13:43Z
- **Completed:** 2026-02-21T22:29:05Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- `acsync render --type command --name <name> [--target <target>]` outputs rendered content to stdout
- `acsync diff [--target] [--type]` shows unified text diff with --- / +++ headers and @@ hunks
- `--json` flag accepted on check and push (no-op; documents JSON-default for scripts)
- 13 new tests across 2 test files, 448 total tests passing with 0 failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Add render subcommand** - `e4a7fa0` (feat)
2. **Task 2: Add diff subcommand and --json flag** - `987ed23` (feat)

## Files Created/Modified
- `src/cli/render.ts` - Render subcommand: --type, --name, --target options, multi-target header output
- `src/cli/diff.ts` - Diff subcommand: unified diff with LCS algorithm, hunk generation, exit codes
- `src/cli/__tests__/render.test.ts` - Tests: rendering commands, skills, MCP, instructions across all targets
- `src/cli/__tests__/diff.test.ts` - Tests: unified diff output format, headers, additions, removals
- `src/cli/index.ts` - Register render + diff subcommands
- `src/cli/orchestrator.ts` - Export createAdapter, ALL_TARGETS, and 5 read* functions
- `src/cli/check.ts` - Add --json flag option
- `src/cli/push.ts` - Add --json flag option

## Decisions Made
- Exported orchestrator internals (createAdapter, read* functions) rather than creating a new abstraction layer — render and diff need the same canonical reading + adapter rendering logic
- Built LCS-based unified diff from scratch instead of adding `diff` npm package — keeps deps minimal, sufficient for v1
- Greedy LCS fallback for large files (>1M line-pairs) avoids O(n^2) memory consumption

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ready for 04-02-PLAN.md (Date.now() collision fix + skills.test.ts host dependency)
- All 448 tests passing, 0 failures

## Self-Check: PASSED

All 4 created files verified on disk. Both commit hashes (e4a7fa0, 987ed23) found in git log.

---
*Phase: 04-cli-subcommands-test-fixes*
*Completed: 2026-02-21*
