---
phase: 05-dead-code-cleanup-integration
plan: 01
subsystem: infra
tags: [dead-code, atomic-write, backup, rollback, cleanup]

requires:
  - phase: 04-cli-subcommands-test-fixes
    provides: working CLI with rollback and atomic write
provides:
  - Pure atomicWrite without backup side-effect
  - Single rollback-level backup strategy (tmpdir-based)
  - Clean codebase with no dead exports
affects: [05-02, integration-tests]

tech-stack:
  added: []
  patterns:
    - "atomicWrite is pure atomic (temp+fsync+rename, no backup)"
    - "Rollback backups go to os.tmpdir(), not .acsync/backups/"

key-files:
  created: []
  modified:
    - src/infra/atomic-write.ts
    - src/core/rollback.ts
    - src/core/manifest.ts
    - src/cli/orchestrator.ts
    - src/errors.ts

key-decisions:
  - "Deleted backup.ts entirely — backupFile had no remaining callers after atomicWrite cleanup"
  - "DiffError removed — grep confirmed zero imports outside errors.ts"

patterns-established:
  - "Single backup strategy: rollback-level createBackup in tmpdir, no per-file backup in atomicWrite"

requirements-completed: [HYGIENE-DEAD-CODE, HYGIENE-BACKUP]

duration: 7min
completed: 2026-02-21
---

# Phase 5 Plan 1: Dead Code & Backup Consolidation Summary

**Removed 12 dead exports, deleted 6 files, purified atomicWrite to temp+fsync+rename with single rollback-level backup in tmpdir**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-21T23:26:40Z
- **Completed:** 2026-02-21T23:34:32Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Removed all 12 dead exports identified in v1 audit (pruneBackups, createBackupDir, hashFile, hashDirectory, loadSecrets, injectSecrets, redactSecrets, SecretError, DiffError, shouldRollback, isSyncError, getErrorSeverity)
- Deleted 6 entire files: hash.ts, env-loader.ts, injector.ts + their test files
- Purified atomicWrite to `(targetPath, content)` — no backup side-effect
- Moved rollback backup location from `.acsync/backups/` to `os.tmpdir()`
- Eliminated double-backup problem on push

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove dead exports and their tests** - `1ef78fc` (refactor)
2. **Task 2: Remove backup from atomicWrite and update all callers** - `bfa8efe` (refactor)

## Files Created/Modified
- `src/errors.ts` - Removed SecretError, DiffError, shouldRollback, isSyncError, getErrorSeverity
- `src/infra/atomic-write.ts` - Pure atomic write: removed backupFile import and backupDir parameter
- `src/infra/backup.ts` - Deleted entirely (no remaining callers)
- `src/infra/hash.ts` - Deleted entirely (dead: hashFile, hashDirectory)
- `src/secrets/env-loader.ts` - Deleted entirely (dead: loadSecrets)
- `src/secrets/injector.ts` - Deleted entirely (dead: injectSecrets, redactSecrets)
- `src/core/rollback.ts` - createBackup now uses tmpdir; restoreBackup uses atomicWrite without backupDir
- `src/core/manifest.ts` - saveManifest calls atomicWrite without backupDir
- `src/cli/orchestrator.ts` - runPush calls atomicWrite without backupDir
- `src/core/__tests__/rollback.test.ts` - Updated backup path assertions for tmpdir
- `src/infra/__tests__/atomic-write.test.ts` - Removed backupDir from all test calls
- `src/infra/__tests__/backup.test.ts` - Deleted (tested deleted code)
- `src/infra/__tests__/hash.test.ts` - Deleted (tested deleted code)
- `src/secrets/__tests__/env-loader.test.ts` - Deleted (tested deleted code)
- `src/secrets/__tests__/injector.test.ts` - Deleted (tested deleted code)

## Decisions Made
- Deleted backup.ts entirely rather than keeping backupFile — no production code imports it after atomicWrite cleanup
- DiffError confirmed dead via grep (zero imports outside errors.ts) — removed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed undefined `dir` variable in createBackup**
- **Found during:** Task 2 (rollback.ts update)
- **Issue:** After removing `dirname` import and replacing `dir` with `backupDir`, the `mkdir(dir, ...)` call still referenced the old variable
- **Fix:** Changed `mkdir(dir, ...)` to `mkdir(backupDir, ...)`
- **Files modified:** src/core/rollback.ts
- **Verification:** All 414 tests pass
- **Committed in:** bfa8efe (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Self-inflicted typo during edit, caught immediately by tests. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Dead code removed, single backup strategy in place
- Ready for Plan 2 (index barrel cleanup / integration consolidation)
- 414 tests passing across 29 files

## Self-Check: PASSED

- All key files verified (created/deleted as expected)
- Both task commits found in git log (1ef78fc, bfa8efe)
- 414 tests pass across 29 files

---
*Phase: 05-dead-code-cleanup-integration*
*Completed: 2026-02-21*
