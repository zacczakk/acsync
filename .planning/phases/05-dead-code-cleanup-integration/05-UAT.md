---
status: diagnosed
phase: 05-dead-code-cleanup-integration
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md]
started: 2026-02-22T12:00:00Z
updated: 2026-02-22T12:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Dead exports removed
expected: grep for pruneBackups, createBackupDir, hashFile, hashDirectory, loadSecrets, injectSecrets, redactSecrets, SecretError, DiffError, shouldRollback, isSyncError, getErrorSeverity across src/. None should appear as exports or imports in any production or test file.
result: pass

### 2. backup.ts deleted
expected: `src/infra/backup.ts` and `src/infra/__tests__/backup.test.ts` no longer exist on disk. Similarly `src/infra/hash.ts`, `src/secrets/env-loader.ts`, `src/secrets/injector.ts` and their test files are gone.
result: pass

### 3. atomicWrite is pure (no backup parameter)
expected: `src/infra/atomic-write.ts` exports atomicWrite with signature `(targetPath, content)` only. No backup directory parameter, no backup import.
result: pass

### 4. Orchestrator split into modules
expected: Four new files exist: `src/cli/canonical.ts`, `src/cli/sync-check.ts`, `src/cli/sync-push.ts`, `src/cli/sync-pull.ts`. Each is under 500 LOC. `src/cli/orchestrator.ts` is a thin re-export facade (<50 LOC).
result: pass

### 5. Pull uses atomicWrite + rollback
expected: `src/cli/sync-pull.ts` imports atomicWrite from infra and uses createBackup/restoreAll/cleanupAll from rollback. Same crash-safety pattern as push.
result: issue
reported: "okay but name is wrong. i want check.ts, push.ts and pull.ts"
severity: major

### 6. Full test suite passes
expected: `bun test` runs with 0 failures. All 414+ tests pass.
result: pass

## Summary

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Orchestrator modules named check.ts, push.ts, pull.ts (not sync-check.ts, sync-push.ts, sync-pull.ts)"
  status: failed
  reason: "User reported: okay but name is wrong. i want check.ts, push.ts and pull.ts"
  severity: major
  test: 5
  root_cause: "sync-* prefix was used to avoid colliding with existing Commander wrapper files (check.ts, push.ts, pull.ts). Fix: merge thin Commander wrappers into the logic modules, delete wrappers, rename sync-* to clean names. Also orchestrator.ts facade has zero importers — dead code."
  artifacts:
    - path: "src/cli/sync-check.ts"
      issue: "Should be check.ts — merge checkCommand from current check.ts into this file"
    - path: "src/cli/sync-push.ts"
      issue: "Should be push.ts — merge pushCommand from current push.ts into this file"
    - path: "src/cli/sync-pull.ts"
      issue: "Should be pull.ts — merge pullCommand from current pull.ts into this file"
    - path: "src/cli/check.ts"
      issue: "Thin Commander wrapper (32 LOC) — merge into sync-check.ts then delete"
    - path: "src/cli/push.ts"
      issue: "Thin Commander wrapper (88 LOC) — merge into sync-push.ts then delete"
    - path: "src/cli/pull.ts"
      issue: "Thin Commander wrapper (80 LOC) — merge into sync-pull.ts then delete"
    - path: "src/cli/orchestrator.ts"
      issue: "Re-export facade with zero importers — dead code, delete"
  missing:
    - "Delete orchestrator.ts (zero importers)"
    - "Extract duplicated confirm() from push.ts and pull.ts into cli-helpers.ts"
    - "Merge Commander wrapper code from check.ts/push.ts/pull.ts into sync-check.ts/sync-push.ts/sync-pull.ts"
    - "Delete old check.ts, push.ts, pull.ts"
    - "Rename sync-check.ts -> check.ts, sync-push.ts -> push.ts, sync-pull.ts -> pull.ts"
    - "Update imports in diff.ts, push.ts (internal), and test files"
    - "Run tests to verify"
  debug_session: ""
