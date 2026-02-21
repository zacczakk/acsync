# Phase 5: Dead Code Cleanup + Integration Hygiene - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove dead exports, eliminate double-backup, wire atomicWrite into pull, split orchestrator into modules <500 LOC. No new features — hygiene only. All tests must pass after cleanup.

</domain>

<decisions>
## Implementation Decisions

### Dead export disposition
- Investigate each of the ~12 listed exports against vsync usage patterns — wire in useful ones, delete the rest
- vsync is battle-tested; if an export is meaningful there, it's likely meaningful here too
- Optimize for minimal codebase — no bloat, pick wisely
- Claude's discretion on whether to match vsync call sites or adapt to acsync's simpler model per-export
- Secret-related exports (loadSecrets, injectSecrets, redactSecrets, SecretError) are dead — Phase 3 decision holds: CLIs resolve env vars natively, no injection
- When deleting: remove both the export AND the underlying implementation code. Git preserves history.

### Orchestrator split strategy
- Split into flat sibling files in src/cli/ (not nested under src/orchestrator/)
- Operation-named modules: push.ts, pull.ts, check.ts, etc.
- Claude's discretion on exact split boundaries and whether orchestrator.ts remains as facade or gets deleted
- Each resulting module must be <500 LOC

### Backup consolidation
- Single strategy: rollback-level (Phase 3's BackupInfo[] per-push with restoreAll on failure)
- Remove per-file backup from atomicWrite — keep atomic semantics (temp + fsync + rename), just no backup copy
- Move backup directory from .acsync/backups/ to os.tmpdir() (transient, auto-cleanup)
- Keep backups until next push (safety net), not immediate cleanup on success

### Pull safety behavior
- Pull gets full rollback like push (restore-on-failure across all canonical files)
- Pull warns before overwriting canonical files (source of truth is more dangerous to modify)
- Default: file count summary ("3 canonical files would be updated. Continue? (y/N)")
- Flag for per-file diff detail (e.g., --diff or --verbose)
- --force skips the confirmation prompt (for CI/scripting)

### Claude's Discretion
- Exact split of orchestrator modules (boundaries, which functions go where)
- Per-export decision on wire-in vs delete (except secrets — those are dead)
- Whether to match vsync patterns or adapt per function
- Whether orchestrator.ts remains as re-export facade or is fully replaced

</decisions>

<specifics>
## Specific Ideas

- vsync at ~/Repos/oss/vsync/cli/src/ is the reference for how each dead export is used in practice
- "Investigate and wire in useful ones" — not blind port, not blind delete. Evaluate each.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-dead-code-cleanup-integration*
*Context gathered: 2026-02-22*
