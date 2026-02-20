---
phase: 03-diff-engine-cli
plan: 02
subsystem: cli
tags: [commander, cli, orchestrator, check, push, rollback, manifest, diff]

# Dependency graph
requires:
  - phase: 03-diff-engine-cli
    plan: 01
    provides: calculateDiff, formatCheckResult, formatPushResult, loadManifest, saveManifest, updateManifestItem, createBackup, restoreAll, cleanupAll
  - phase: 02-renderers-secrets
    provides: adapter renderCommand/renderAgent/renderMCPServers/renderInstructions, AdapterPathResolver
  - phase: 01-foundation
    provides: atomicWrite, hashFile, createExclusionFilter, loadSecrets, injectSecrets
provides:
  - acsync check subcommand — drift detection, JSON/pretty output, exit code 2 on drift
  - acsync push subcommand — render + write with rollback on failure, --dry-run/--force
  - Sync orchestrator (runCheck, runPush) — canonical item discovery, render, diff, write pipeline
  - CLI flag helpers: mapTargets(), mapTypes(), validateTargets(), validateTypes(), collect()
  - getPaths() public accessor added to BaseAdapter for orchestrator path resolution
affects: []

# Tech tracking
tech-stack:
  added: [commander@^14.0.3 (already present)]
  patterns:
    - "Orchestrator pattern: runCheck → renderAll → calculateDiff; runPush → runCheck → write with backup"
    - "User-facing target names: claude/gemini/codex/opencode (claude→claude-code internally)"
    - "User-facing type names: plural (commands/agents/mcps/instructions/skills → singular internal)"
    - "Exit codes: 0=success/no-drift, 1=error, 2=drift detected"
    - "JSON default output (agent-first), --pretty for human output"
    - "Per-test unique salts in tests to avoid real filesystem state collisions"

key-files:
  created:
    - src/cli/orchestrator.ts
    - src/cli/index.ts
    - src/cli/check.ts
    - src/cli/push.ts
    - src/cli/cli-helpers.ts
    - src/cli/__tests__/orchestrator.test.ts
    - src/cli/__tests__/check.test.ts
    - src/cli/__tests__/push.test.ts
  modified:
    - src/adapters/base.ts
    - package.json

key-decisions:
  - "getPaths() added to BaseAdapter as public method — orchestrator needs MCP/instructions path without subclassing"
  - "Per-test unique salts in integration tests — real filesystem state persists across test runs since push writes to real ~/.claude etc."
  - "push command: force=true skips prompt, dryRun short-circuits before any writes"
  - "Orchestrator reads canonical items, renders through adapters, hashes rendered content (not source files)"
  - "MCP: single operation per target (the entire MCP settings file, not per-server)"

patterns-established:
  - "CLI flag → SyncOptions: mapTargets/mapTypes convert user-facing names to internal types"
  - "Orchestrator: discover all → render all → hash all → calculateDiff → (push: backup → write → manifest)"
  - "Integration tests use mkdtemp + unique salt; push writes to real target paths"

requirements-completed: [CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06, CLI-07, CLI-08, CLI-09, FILE-03]

# Metrics
duration: 10min
completed: 2026-02-20
---

# Phase 03 Plan 02: CLI Shell + Orchestrator Summary

**acsync CLI with check/push subcommands, sync orchestrator wiring all Phase 01-02 modules, JSON-default output, exit codes 0/1/2, and rollback on push failure**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-20T19:39:21Z
- **Completed:** 2026-02-20T19:49:32Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Sync orchestrator (`runCheck`/`runPush`) — discovers canonical items, renders through adapters, diffs, writes with atomicWrite + rollback
- `acsync check` — detects drift, JSON by default, exit code 2 on drift, exit 0 when synced
- `acsync push` — renders + writes with backup/rollback on failure, `--dry-run`/`--force`/`--target`/`--type`/`--pretty`
- CLI helpers — `collect()`, `mapTargets()`, `mapTypes()`, `validateTargets()`, `validateTypes()`
- 55 new tests (19 orchestrator integration + 36 CLI unit)

## Task Commits

Each task was committed atomically:

1. **Task 1: Sync orchestrator** - `983ad55` (feat)
2. **Task 2: CLI entry point with check and push subcommands** - `89d0c5a` (feat)

## Files Created/Modified
- `src/cli/orchestrator.ts` — Core engine: reads canonical items, renders through adapters, hashes, diffs, writes
- `src/cli/index.ts` — Commander.js entry point, `acsync` binary, exitOverride for proper exit codes
- `src/cli/check.ts` — check subcommand with --pretty/--target/--type, exit code 2 on drift
- `src/cli/push.ts` — push subcommand with --dry-run/--force/--pretty/--target/--type, confirm prompt
- `src/cli/cli-helpers.ts` — collect(), mapTargets(), mapTypes(), validateTargets(), validateTypes()
- `src/cli/__tests__/orchestrator.test.ts` — 19 integration tests (check/push/dry-run/manifest/drift)
- `src/cli/__tests__/check.test.ts` — 25 unit tests (collect, mapTargets, mapTypes, validate*)
- `src/cli/__tests__/push.test.ts` — 11 unit tests (push flag→option mapping)
- `src/adapters/base.ts` — Added `getPaths(): AdapterPathResolver` public method
- `package.json` — Added `bin.acsync` pointing to `src/cli/index.ts`

## Decisions Made
- **getPaths() on BaseAdapter:** Orchestrator needs MCP config path and instructions path for each target — added public `getPaths()` accessor rather than casting to `BaseAdapter` (cleaner)
- **Integration test isolation:** Tests write to real `~/.claude/commands/` etc., so each test uses per-test unique salt in filenames to avoid cross-test state pollution
- **Rendered content hashing:** Orchestrator hashes the rendered content string (not source files), ensuring hash comparison is against what would actually be written

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `getPaths()` public accessor to BaseAdapter**
- **Found during:** Task 1 (orchestrator.ts MCP/instructions path lookup)
- **Issue:** `paths` is `protected` on `BaseAdapter`, but orchestrator needs `getMCPConfigPath()` and `getInstructionsPath()` without subclassing or unsafe casting
- **Fix:** Added `getPaths(): AdapterPathResolver` to both `ToolAdapter` interface and `BaseAdapter` class
- **Files modified:** src/adapters/base.ts
- **Verification:** All 341 tests pass
- **Committed in:** 983ad55 (Task 1 commit)

**2. [Rule 1 - Bug] Added `hasDrift` field to `OrchestratorPushResult`**
- **Found during:** Task 1 testing (test accessed `result.hasDrift` which was `undefined`)
- **Issue:** `OrchestratorPushResult` interface was missing `hasDrift`, but early-return paths need to communicate drift status to callers
- **Fix:** Added `hasDrift: boolean` to interface, populated all return paths
- **Files modified:** src/cli/orchestrator.ts
- **Verification:** Tests pass with correct hasDrift values
- **Committed in:** 983ad55 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both fixes necessary for correct API. No scope creep.

## Issues Encountered
- Integration tests initially failed because commands written in one test persist to real `~/.claude/commands/` — subsequent tests see "skip" instead of "create". Fixed by using per-test unique salted filenames.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 3 Plan 02 complete — only Plan 03 (final integration/e2e verification) remains
- Full CLI works: `bun src/cli/index.ts check --target claude --type commands` produces correct diff
- 341 tests passing (55 new from this plan)

## Self-Check: PASSED
- All 8 key files exist on disk ✓
- Both task commits found: 983ad55 (orchestrator), 89d0c5a (CLI) ✓
- 341 tests passing, 0 failures ✓

---
*Phase: 03-diff-engine-cli*
*Completed: 2026-02-20*
