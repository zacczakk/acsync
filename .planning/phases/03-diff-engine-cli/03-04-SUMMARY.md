---
phase: 03-diff-engine-cli
plan: "04"
subsystem: cli
tags: [claude-code, path-resolver, push, delete, sync]

requires:
  - phase: 03-diff-engine-cli
    provides: orchestrator, push CLI, path resolver with zz/ nesting

provides:
  - Claude commands render to ~/.claude/commands/{name}.md (no zz/ subdir)
  - push --delete flag controls stale file deletion
  - SyncOptions.deleteStale field for programmatic control

affects: [claude-code adapter, path-resolver, push CLI, orchestrator]

tech-stack:
  added: []
  patterns:
    - "Opt-in deletion: delete loop gated behind options.deleteStale"
    - "Flat command paths: Claude commands at ~/.claude/commands/{name}.md"

key-files:
  created: []
  modified:
    - src/adapters/path-resolver.ts
    - src/adapters/claude-code.ts
    - src/adapters/__tests__/claude-code.test.ts
    - src/adapters/__tests__/reverse-parsing.test.ts
    - src/cli/orchestrator.ts
    - src/cli/push.ts

key-decisions:
  - "Claude commands go to ~/.claude/commands/{name}.md — no zz/ nesting, no prefix logic"
  - "Stale deletion is opt-in via --delete flag; omitting it skips deletes (safe default)"

patterns-established:
  - "deleteStale: boolean opt-in pattern for destructive operations"

requirements-completed: [CLI-05, CLI-07, DIFF-03]

duration: 5min
completed: 2026-02-21
---

# Phase 3 Plan 4: Claude Path Fix + Push --delete Flag Summary

**Removed zz/ subdir nesting from Claude command paths and added opt-in --delete flag to push CLI with guarded delete loop in orchestrator**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-21T14:40:16Z
- **Completed:** 2026-02-21T14:45:25Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Claude commands now render to `~/.claude/commands/{name}.md` (was `~/.claude/commands/zz/{name}.md`)
- Removed `commandNameFromFile` override from `ClaudeCodeAdapter` — base class default handles `.md → name`
- Removed `commandFileName` claude-code case from `path-resolver.ts` — falls through to default `${name}.md`
- Added `deleteStale?: boolean` to `SyncOptions` interface in orchestrator
- Added `--delete` flag to `push` CLI, wired into `syncOpts.deleteStale`
- Gated delete loop in `runPush` behind `if (options.deleteStale)` — stale files skipped unless flag set

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix Claude command path — remove zz/ subdir and prefix logic** - `05e80ad` (fix)
2. **Task 2: Add --delete flag to push; gate delete loop in orchestrator** - `00ef9d6` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `src/adapters/path-resolver.ts` — rawCommandsDir `~/.claude/commands/` (no zz/), removed claude-code commandFileName case
- `src/adapters/claude-code.ts` — removed commandNameFromFile override, removed zz/ path comment
- `src/adapters/__tests__/claude-code.test.ts` — updated path assertions to no-zz/ paths
- `src/adapters/__tests__/reverse-parsing.test.ts` — updated Claude commandNameFromFile assertions (new file committed)
- `src/cli/orchestrator.ts` — added `deleteStale?: boolean` to SyncOptions, wrapped delete loop
- `src/cli/push.ts` — added `--delete` flag, wired deleteStale into syncOpts

## Decisions Made
- Claude commands: flat layout `~/.claude/commands/{name}.md` — no zz/ nesting, no prefix stripping. Source filenames are canonical (e.g., `zz-plan.md` stays `zz-plan`).
- Stale deletion opt-in: `--delete` flag required. Check always shows stale items in output regardless.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated reverse-parsing.test.ts for removed commandNameFromFile behavior**
- **Found during:** Task 2 (full bun test run)
- **Issue:** `reverse-parsing.test.ts` tested `plan.md → zz-plan` (old override behavior). After removing override, base class returns `plan` for `plan.md`.
- **Fix:** Updated 2 test assertions: `plan.md → plan` and added `zz-plan.md → zz-plan` (name preserved as-is)
- **Files modified:** `src/adapters/__tests__/reverse-parsing.test.ts`
- **Verification:** `bun test` — 431 pass, 4 fail (all pre-existing)
- **Committed in:** `00ef9d6` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test assertions reflected removed behavior — auto-fixed to match new correct behavior. No scope creep.

## Issues Encountered
- 4 pre-existing test failures unrelated to this plan: `rollback.test.ts` (reverse order logic bug) + `skills.test.ts` (ralph-tui-create-beads skill missing from real ~/.claude/skills/). Both pre-existed before first commit of this plan.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Phase 3 complete. All 4 plans done.
- Claude commands sync to flat `~/.claude/commands/` — ready for production use
- Push --delete flag works for opt-in stale cleanup

## Self-Check: PASSED

- All modified files exist on disk ✓
- Commit `05e80ad` (Task 1) verified in git log ✓
- Commit `00ef9d6` (Task 2) verified in git log ✓
- SUMMARY.md created ✓

---
*Phase: 03-diff-engine-cli*
*Completed: 2026-02-21*
