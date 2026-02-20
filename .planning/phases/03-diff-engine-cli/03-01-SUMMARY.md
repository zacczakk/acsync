---
phase: 03-diff-engine-cli
plan: 01
subsystem: core
tags: [manifest, diff, rollback, formatter, picocolors, atomic-write]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: atomicWrite, backupFile, hashFile, SyncError hierarchy, CanonicalItem, TargetName
  - phase: 02-renderers-secrets
    provides: adapter outputs (RenderedFile), format parsers
provides:
  - Manifest CRUD (loadManifest, saveManifest, createEmptyManifest, updateManifestItem, getManifestHash)
  - 3-way diff engine (compareHashes, calculateDiff) — no delete operations
  - Rollback mechanism (createBackup, restoreBackup, cleanupBackup, restoreAll, cleanupAll)
  - Output formatters (formatDiffJson, formatDiffPretty, formatPushResult, formatCheckResult)
  - ItemType, OperationType, ManifestItem, Manifest, Operation, DiffResult types
  - DiffError, ManifestError, RollbackError error classes
affects: [03-02-cli-shell]

# Tech tracking
tech-stack:
  added: [picocolors@1.1.1]
  patterns:
    - "Manifest stored at .acsync/manifest.json in project root (not ~/.vsync/cache/)"
    - "3-way hash comparison: source/target/manifest — never produces delete"
    - "Rollback uses reverse-order restore with verbose console.error logging"
    - "formatCheckResult returns {output, hasDrift} for CLI exit code calculation"
    - "JSON is default output, --pretty for human-readable (agent-first design)"

key-files:
  created:
    - src/core/manifest.ts
    - src/core/diff.ts
    - src/core/rollback.ts
    - src/core/formatter.ts
    - src/core/__tests__/manifest.test.ts
    - src/core/__tests__/diff.test.ts
    - src/core/__tests__/rollback.test.ts
    - src/core/__tests__/formatter.test.ts
  modified:
    - src/types.ts
    - src/errors.ts
    - package.json

key-decisions:
  - "Manifest path: .acsync/manifest.json in project root (simpler than vsync's ~/.vsync/cache/<hash>/)"
  - "No delete operation type — safe mode only per EXCL-02, simplifies diff logic vs vsync"
  - "saveManifest uses backupDir=.acsync/backups to satisfy atomicWrite signature"
  - "picocolors over chalk — lighter, no dependencies, sufficient for terminal colors"
  - "restoreAll processes in reverse order — last written restored first (correct order for sequential ops)"

patterns-established:
  - "ManifestItem key pattern: type/name (e.g., command/gsd-plan-phase)"
  - "compareHashes: 5 cases, always returns skip/create/update — never delete"
  - "calculateDiff: Map<'type/name', hash> for target hash lookup"
  - "formatCheckResult returns {output, hasDrift} — caller decides exit code"

requirements-completed: [DIFF-02, DIFF-03, DIFF-04, DIFF-05, FILE-04]

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 03 Plan 01: Diff Engine + Core Modules Summary

**3-way hash diff engine, atomic manifest CRUD at .acsync/manifest.json, per-file rollback with reverse-order restore, and JSON+pretty formatters using picocolors**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-20T19:33:06Z
- **Completed:** 2026-02-20T19:36:23Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Manifest CRUD with atomic writes — load (empty on missing/corrupt), save (mkdir .acsync, atomicWrite), updateManifestItem, getManifestHash
- 3-way diff engine — compareHashes (5 cases, never delete), calculateDiff iterating source items against target hash map
- Rollback mechanism — createBackup (Bun.file().exists()), restoreAll (reverse order, verbose), cleanupAll
- Dual-mode formatters — formatDiffJson (agent-consumable), formatDiffPretty (picocolors, gh pr status style), formatCheckResult with hasDrift boolean

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, manifest manager, and 3-way diff engine** - `a9a6ff4` (feat)
2. **Task 2: Rollback mechanism and output formatters** - `f349877` (feat)

## Files Created/Modified
- `src/types.ts` - Added ItemType, OperationType, ManifestItem, Manifest, Operation, DiffResult
- `src/errors.ts` - Added DiffError, ManifestError, RollbackError
- `src/core/manifest.ts` - Manifest CRUD with atomicWrite
- `src/core/diff.ts` - compareHashes and calculateDiff
- `src/core/rollback.ts` - createBackup/restoreBackup/cleanupBackup/restoreAll/cleanupAll
- `src/core/formatter.ts` - formatDiffJson, formatDiffPretty, formatPushResult, formatCheckResult
- `src/core/__tests__/manifest.test.ts` - 22 tests
- `src/core/__tests__/diff.test.ts` - 11 tests
- `src/core/__tests__/rollback.test.ts` - 16 tests
- `src/core/__tests__/formatter.test.ts` - 18 tests
- `package.json` - Added picocolors@1.1.1

## Decisions Made
- **Manifest location:** `.acsync/manifest.json` in project root — simpler than vsync's `~/.vsync/cache/<hash>/manifest.json`, fits our local tool model
- **No delete operation:** Safe mode only per EXCL-02 — diff engine never produces delete, simplifies compareHashes to 5 cases
- **saveManifest backupDir:** Uses `.acsync/backups` to satisfy atomicWrite's required `backupDir` parameter (discovered during implementation)
- **picocolors over chalk:** Lighter (no dependencies), sufficient for our terminal color needs
- **Reverse-order restore:** restoreAll processes backups reversed — ensures last-written file is restored first, correct for sequential push operations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] atomicWrite requires backupDir parameter**
- **Found during:** Task 1 (manifest.ts saveManifest)
- **Issue:** Plan said "use atomicWrite" but our atomicWrite signature requires `(path, content, backupDir)` — plan didn't specify backupDir
- **Fix:** saveManifest passes `.acsync/backups` as backupDir; rollback.ts restoreBackup passes `.acsync/restore-backups`
- **Files modified:** src/core/manifest.ts, src/core/rollback.ts
- **Verification:** Tests pass, manifest saves and loads correctly
- **Committed in:** a9a6ff4 (Task 1 commit), f349877 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Necessary adjustment to match actual atomicWrite API signature. No scope creep.

## Issues Encountered
None — all verification passed on first run.

## Next Phase Readiness
- Diff engine core complete — Plan 02 (CLI shell) can import calculateDiff, formatCheckResult, restoreAll
- Full suite: 286 tests passing (219 existing + 67 new)
- No regressions from Phases 1 and 2

---
*Phase: 03-diff-engine-cli*
*Completed: 2026-02-20*
