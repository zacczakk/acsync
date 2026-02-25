# Roadmap: Agent Config Sync CLI

## Overview

Deterministic CLI that renders canonical agent configs to 4 target CLI formats, detects drift via hash-based diffs, and pushes changes with atomic writes. v1.0 built the core. v2.0 simplified canonical structure. v3.0 hardens the test suite with E2E fixture-based tests covering push and pull across all 4 targets for all 6 config types.

## Milestones

- ✅ **v1.0 Foundation** - Phases 1-5 (shipped 2026-02-22)
- ✅ **v2.0 Simplify Canonical** - Phases 6-9 (shipped 2026-02-25)
- 🚧 **v3.0 Harden Test Suite** - Phases 10-12 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

<details>
<summary>✅ v1.0 Foundation (Phases 1-5) - SHIPPED 2026-02-22</summary>

- [x] **Phase 1: Foundation** - Types, infra (atomic writes, backup, hashing), format parsers, exclusion filters
- [x] **Phase 2: Renderers + Secrets** - All config rendering for 4 targets + secret injection + env var conversion
- [x] **Phase 3: Diff Engine + CLI** - Manifest, 3-way diff, CLI subcommands, output formats, dry-run
- [x] **Phase 4: CLI Subcommands + Test Fixes** - Add render/diff subcommands, --json flag, fix test failures
- [x] **Phase 5: Dead Code Cleanup + Integration Hygiene** - Remove dead exports, eliminate double-backup, wire atomicWrite into pull, split orchestrator

</details>

## Phase Details

<details>
<summary>✅ v1.0 Foundation (Phases 1-5)</summary>


### Phase 1: Foundation
**Goal**: Infrastructure layer exists — deterministic hashing, safe file operations, and exclusion filtering
**Depends on**: Nothing (first phase)
**Requirements**: DIFF-01, FILE-01, FILE-02, EXCL-01, EXCL-02
**Success Criteria** (what must be TRUE):
  1. Content hash of any file or directory returns deterministic SHA-256
  2. File writes are atomic (write to temp → fsync → rename into place)
  3. Timestamped backup copy is created before any file overwrite
  4. `gsd-*` files/directories and non-canonical items are excluded from processing
**Plans:** 2/2 plans complete

Plans:
- [x] 01-01-PLAN.md — Types, errors, exclusion filter, hash, backup, atomic write + tests
- [x] 01-02-PLAN.md — Format parsers (JSON, JSONC, TOML, Markdown frontmatter) + round-trip tests

### Phase 2: Renderers + Secrets
**Goal**: Lightweight rendering — pure functions that transform canonical configs to target formats. Borrow proven logic from vsync (`~/Repos/oss/vsync/cli/src/`) wherever applicable; do NOT re-derive what vsync already solved.
**Approach**: vsync has a full adapter class hierarchy (registry, plugin system, rollback, i18n, parallel sync). We don't need any of that. Extract only the transformation logic into standalone render functions. Key vsync modules to borrow from:
  - `utils/env-var-transformer.ts` — normalize-then-convert pattern for `${VAR}` / `{env:VAR}` / `${env:VAR}` (SECR-03)
  - `utils/mcp-utils.ts` — MCP type inference + field population helpers (RNDR-09–12)
  - `adapters/claude-code.ts`, `opencode.ts`, `codex.ts` — format-specific serialization logic for MCP, commands, agents
  - JSONC-preserving edit pattern via `jsonc-parser` (already used in Phase 1)
  - `gray-matter` for frontmatter parse/stringify (commands + agents)
**Depends on**: Phase 1
**Requirements**: RNDR-01, RNDR-02, RNDR-03, RNDR-04, RNDR-05, RNDR-06, RNDR-07, RNDR-08, RNDR-09, RNDR-10, RNDR-11, RNDR-12, RNDR-13, RNDR-14, SECR-01, SECR-02, SECR-03
**Success Criteria** (what must be TRUE):
  1. Each canonical config type (command, agent, MCP, instruction, skill) renders to all 4 target formats correctly
  2. Secrets from `.env` are loaded and injected into rendered output (placeholders replaced with real values)
  3. Env var syntax matches target conventions (`${VAR}` for Claude/Gemini, `{env:VAR}` for OpenCode, none for Codex)
  4. Format integrity preserved: JSONC comments survive, TOML types are correct, frontmatter round-trips cleanly
  5. Renderers are pure functions (input → output string), no class hierarchies or adapter registries
**Plans:** 3/3 plans complete

Plans:
- [x] 02-01-PLAN.md — Secrets (env-loader, injector, EnvVarTransformer) + types + BaseAdapter/PathResolver
- [x] 02-02-PLAN.md — Command + agent renderers (4 adapters × 2 methods = 8 render functions)
- [x] 02-03-PLAN.md — MCP rendering (4 targets) + instructions + skills

### Phase 3: Diff Engine + CLI
**Goal**: End-to-end CLI works — diff, render, push, check with proper output and exit codes. Rollback replaces Phase 1's backup-only approach with full restore-on-failure semantics.
**Approach**: vsync has a battle-tested diff/manifest/planner stack at `~/Repos/oss/vsync/cli/src/`. Borrow the core logic, strip the things we don't need (i18n, parallel sync, symlinks, adapter registry, prune mode). Key vsync modules to port:
  - `types/manifest.ts` — `Manifest`, `ManifestItem`, `TargetStatus` types (rename `ToolName` → `TargetName`)
  - `types/plan.ts` — `Operation`, `OperationType`, `DiffResult` types
  - `core/manifest-manager.ts` — `loadManifest`, `saveManifest`, `createEmptyManifest` (swap vsync's `~/.vsync/cache/<hash>/` path to a fixed project-local path; reuse Phase 1's `atomicWrite` for saves)
  - `core/diff.ts` — `compareHashes` (3-way: source hash / target hash / manifest hash → create/update/skip) and `calculateDiff` (inner `processSourceItems`/`processTargetItems` pattern). Drop `SyncMode`/prune (not needed v1) and `targetCapabilities` filtering (our renderers handle this already via `disabledFor`)
  - `core/planner.ts` — `generatePlan` (thin per-target loop calling `calculateDiff`), `formatPlan` (grouped colored output for DIFF-05), `validatePlan` (safety checks on large/delete ops)
  - `core/rollback.ts` — `createBackup`/`restoreBackup`/`cleanupBackup` pattern. Port as replacement for Phase 1's `src/infra/backup.ts` (which only copies files but never restores). vsync's rollback tracks `BackupInfo[]` per push, restores all on first error, cleans up on success
  - `commands/sync.ts` — push orchestration loop pattern: render → createBackup → atomicWrite → updateManifest per item, with rollback on failure
  - `commands/status.ts` — `formatStatus` pattern for `check` subcommand (colored ✓/⚠ output, `hasChanges` boolean for exit code)
  - `cli-setup.ts` — Commander.js registration + `exitOverride` handler
  - `utils/error-formatter.ts` — `formatError` with category + suggestion pattern (simplify: no i18n, no class hierarchy)
  **New dep**: `chalk` (or `picocolors`) for colored terminal output — vsync uses chalk throughout
  **MCPorter context**: See `MCPORTER_ANALYSIS.md` for the hybrid native+MCPorter MCP strategy. Phase 3 implements the operational steps: trim canonical MCP configs to 3, set up `~/.mcporter/mcporter.json` for the remaining 4 servers, update AGENTS.md/docs. This is a config-level task that exercises the push pipeline end-to-end.
**Depends on**: Phase 2
**Requirements**: DIFF-02, DIFF-03, DIFF-04, DIFF-05, FILE-03, FILE-04, CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06, CLI-07, CLI-08, CLI-09
**Success Criteria** (what must be TRUE):
  1. `check` subcommand detects drift between canonical and target configs, exits with code 2
  2. `push` subcommand renders + writes all configs to target locations with rollback on failure
  3. `--dry-run` flag shows execution plan without writing any files
  4. JSON is the default output (agent-first); `--pretty` flag produces human-readable colored text
  5. `--target` and `--type` flags scope operations; exit codes are 0=success, 1=error, 2=drift
  6. Push failure triggers full rollback — all files written in that run are restored to pre-push state
  7. MCPorter hybrid setup is operational: 3 native MCP servers rendered, 4 servers routed through mcporter
**Plans:** 5/5 plans complete

Plans:
- [x] 03-01-PLAN.md — Manifest manager + 3-way diff engine + rollback + output formatters (types, compareHashes/calculateDiff, BackupInfo/restoreAll, JSON+pretty formatters via picocolors)
- [x] 03-02-PLAN.md — CLI shell + sync orchestrator (Commander.js acsync check/push, --pretty/--dry-run/--force/--target/--type, push orchestration with rollback, exit codes 0/1/2)
- [x] 03-03-PLAN.md — MCPorter hybrid setup + E2E verification (trim canonical MCP to 3 servers, update AGENTS.md + addendums, exercise full acsync check→push pipeline)

### Phase 4: CLI Subcommands + Test Fixes
**Goal**: All CLI interface requirements satisfied — named subcommands exist, flags match spec, tests pass
**Depends on**: Phase 3
**Requirements**: CLI-01, CLI-02, CLI-05
**Gap Closure**: Closes requirement gaps from v1 audit
**Success Criteria** (what must be TRUE):
  1. `acsync render` subcommand renders a single canonical config to stdout in target format
  2. `acsync diff` subcommand exists (alias for check) showing what would change
  3. `--json` flag accepted on all subcommands (no-op since JSON is default; documents intent)
  4. Date.now() collision in rollback createBackup fixed (no test failures in tight loops)
  5. skills.test.ts uses temp directory instead of depending on host environment
  6. All tests pass: 0 failures

**Plans:** 2/2 plans complete

Plans:
- [x] 04-01-PLAN.md — Add render + diff subcommands, --json flag
- [x] 04-02-PLAN.md — Fix Date.now() collision in rollback + skills.test.ts host dependency

### Phase 5: Dead Code Cleanup + Integration Hygiene
**Goal**: No dead exports, no redundant operations, orchestrator under 500 LOC, consistent safety guarantees
**Depends on**: Phase 4
**Requirements**: None (integration/tech debt closure)
**Gap Closure**: Closes integration gaps from v1 audit
**Success Criteria** (what must be TRUE):
  1. No dead exports remain: pruneBackups, createBackupDir, hashFile, hashDirectory, loadSecrets, injectSecrets, redactSecrets, SecretError, shouldRollback, isSyncError, getErrorSeverity, DiffError all removed or wired in
  2. Single backup strategy per push (no double-backup)
  3. pull uses atomicWrite (same crash-safety as push)
  4. orchestrator.ts split into modules, each <500 LOC
  5. All tests pass after cleanup
**Plans:** 3/3 plans complete

Plans:
- [x] 05-01-PLAN.md — Dead code removal + backup consolidation (remove 12 dead exports, strip backup from atomicWrite, single rollback strategy)
- [x] 05-02-PLAN.md — Pull safety + orchestrator split (wire atomicWrite/rollback into pull, split orchestrator into canonical.ts/sync-check.ts/sync-push.ts/sync-pull.ts)
- [x] 05-03-PLAN.md — Module rename: merge Commander wrappers into sync-* modules, rename to check/push/pull, delete orchestrator.ts (gap closure)

</details>

<details>
<summary>✅ v2.0 Simplify Canonical (Phases 6-9) - SHIPPED 2026-02-25</summary>

- [x] **Phase 6: Flatten Canonical Structure** - Move `configs/common/*` up to `configs/`, update all path references in code/tests/docs (completed 2026-02-24)
- [x] **Phase 7: Unify Instructions** - Merge 4 per-CLI addendums into single AGENTS.md, simplify rendering pipeline, fix output filenames (completed 2026-02-24)
- [x] **Phase 8: TOOLS.md + Repo Rename** - Create canonical TOOLS.md, rename repo to `~/Repos/acsync`, propagate paths, clean up stale files (completed 2026-02-24)
- [x] **Phase 9: Verification Closure + Doc Cleanup** - Run Phase 8 verification, update REQUIREMENTS.md checkboxes, clean stale .planning/ references (completed 2026-02-25)

</details>

### 🚧 v3.0 Harden Test Suite (In Progress)

**Milestone Goal:** E2E fixture-based tests covering push and pull across all 4 CLI targets for all 6 config types, with backup/restore safety.

- [ ] **Phase 10: Fixtures Infrastructure + Test Health** - Committed fixture data, backup/restore harness, fix failing tests
- [ ] **Phase 11: Push E2E Tests** - Push all 6 config types to all 4 targets, verify output format
- [ ] **Phase 12: Pull E2E Tests** - Pull all 6 config types from all 4 targets, verify canonical format

### Phase 6: Flatten Canonical Structure
**Goal**: Canonical configs live at `configs/` with no intermediate `common/` directory — all code, tests, and docs reference the new flat path
**Depends on**: Phase 5
**Requirements**: STRUCT-01, STRUCT-02, STRUCT-03, STRUCT-04, STRUCT-05
**Success Criteria** (what must be TRUE):
  1. `configs/agents/`, `configs/commands/`, `configs/mcp/`, `configs/settings/`, `configs/skills/`, `configs/instructions/` exist directly under `configs/`
  2. `configs/common/` directory does not exist
  3. `acsync check` runs successfully against the new path structure (no "not found" errors)
  4. All tests pass with zero references to `configs/common/`
  5. `acsync --help` and error messages reference `configs/` (not `configs/common/`)
**Plans:** 2/2 plans complete

Plans:
- [x] 06-01-PLAN.md — Move configs/common/* to configs/, add path constants, update all references (single atomic commit)
- [x] 06-02-PLAN.md — Gap closure: fix README.md stale refs + wire path constants into render/pull/check

### Phase 7: Unify Instructions
**Goal**: Single canonical `configs/instructions/AGENTS.md` replaces base + 4 addendums — rendering pipeline simplified to single-file passthrough, all 4 targets receive correct output filenames
**Depends on**: Phase 6
**Requirements**: INST-01, INST-02, INST-03, INST-04, INST-05, INST-06, INST-07, INST-08, INST-09, INST-10
**Success Criteria** (what must be TRUE):
  1. `configs/instructions/AGENTS.md` exists with `## CLI-Specific Notes` containing merged content from all 4 addendums
  2. No per-CLI addendum files exist (`claude.md`, `opencode.md`, `gemini.md`, `codex.md` deleted)
  3. `acsync push` writes `~/.claude/CLAUDE.md`, `~/.config/opencode/AGENTS.md`, `~/.gemini/AGENTS.md`, `~/.codex/AGENTS.md` with correct content
  4. `acsync check --type instructions` reports zero drift after push
  5. No `AGENTS.md` at repo root — canonical location is `configs/instructions/AGENTS.md`
**Plans:** 2/2 plans complete

Plans:
- [x] 07-01-PLAN.md — Merge addendums into unified AGENTS.md, simplify rendering pipeline + path-resolver output filenames
- [x] 07-02-PLAN.md — Update tests for new signatures, delete addendum files + repo-root AGENTS.md, verify clean state

### Phase 8: TOOLS.md + Repo Rename
**Goal**: Canonical TOOLS.md exists and is referenced from AGENTS.md; repo lives at `~/Repos/acsync` with all internal paths updated and binary re-registered; stale target files cleaned up
**Depends on**: Phase 7
**Requirements**: TOOL-01, TOOL-02, TOOL-03, REPO-01, REPO-02, REPO-03, REPO-04, REPO-05, REPO-06
**Success Criteria** (what must be TRUE):
  1. `configs/instructions/TOOLS.md` exists with tool-use documentation, referenced by absolute path from AGENTS.md `## Tools` section
  2. Repo folder is `~/Repos/acsync` (not `~/Repos/agents`)
  3. `acsync` binary works from PATH after `bun link` in new location
  4. `acsync push --force` succeeds and propagates all path changes to targets (no `~/Repos/agents` references remain in target files)
  5. Stale target files removed: `~/.config/opencode/OPENCODE.md`, `~/.gemini/GEMINI.md`, `~/.codex/instructions.md`; OpenCode `opencode.json` instructions points to `AGENTS.md`
**Plans:** 2/2 plans complete

Plans:
- [x] 08-01-PLAN.md — Create configs/instructions/TOOLS.md + update AGENTS.md ## Tools section reference
- [x] 08-02-PLAN.md — Rename repo ~/Repos/agents → ~/Repos/acsync, update all path references, bun link, push --force, clean stale files

### Phase 9: Verification Closure + Doc Cleanup
**Goal**: Close all audit gaps — run formal Phase 8 verification, update REQUIREMENTS.md checkboxes, clean stale path references in `.planning/` docs
**Depends on**: Phase 8
**Requirements**: REPO-01, REPO-02, REPO-03, REPO-04, REPO-05, REPO-06, TOOL-01, TOOL-02, TOOL-03
**Gap Closure**: Closes all 9 gaps from v2.0-MILESTONE-AUDIT.md (6 unsatisfied REPO-*, 3 partial TOOL-*)
**Success Criteria** (what must be TRUE):
  1. `08-VERIFICATION.md` exists with formal attestation of all 9 Phase 8 requirements (REPO-01..06, TOOL-01..03)
  2. REQUIREMENTS.md checkboxes for REPO-01..06 are checked (`[x]`)
  3. REQUIREMENTS.md traceability table shows all 24 v2.0 requirements as Complete
  4. Zero stale `configs/common/` references in `.planning/` docs
  5. Zero stale `~/Repos/agents` references in `.planning/` docs
  6. Re-audit scores 24/24 requirements satisfied

**Plans:** 2/2 plans complete

Plans:
- [x] 09-01-PLAN.md — Live verification attestation for Phase 8 + REQUIREMENTS.md checkbox update
- [x] 09-02-PLAN.md — Stale reference cleanup in living docs + audit/milestone closure

</details>

### Phase 10: Fixtures Infrastructure + Test Health
**Goal**: Committed fixture data and backup/restore harness exist — all existing tests pass on a clean baseline before new E2E tests are added
**Depends on**: Phase 9
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04, FIX-05, FIX-06, FIX-07, HLTH-01, HLTH-02
**Success Criteria** (what must be TRUE):
  1. `test/fixtures/` directory exists with `canonical/` and per-target subdirectories (`claude/`, `opencode/`, `gemini/`, `codex/`), all committed to git
  2. Canonical fixtures cover all 6 config types (commands, agents, skills, settings, MCP, instructions) and exercise format-specific features (frontmatter, TOML, JSONC comments, flat markdown)
  3. Per-target fixture sets contain expected push outputs for all 4 CLI targets
  4. Test harness backs up real target directories before E2E tests and restores them after, even on test failure (try/finally)
  5. `bun test` runs via `package.json` test script with zero failures
**Plans:** 3 plans

Plans:
- [ ] 10-01-PLAN.md — Fix 2 failing tests + add package.json test script (health baseline)
- [ ] 10-02-PLAN.md — Create canonical fixture files for all 6 config types + withBackup harness
- [ ] 10-03-PLAN.md — Generate per-target golden fixtures via renderers + smoke test

### Phase 11: Push E2E Tests
**Goal**: E2E tests verify that pushing each of the 6 config types to all 4 real CLI targets produces correct output — 24 push test cells covered
**Depends on**: Phase 10
**Requirements**: PUSH-01, PUSH-02, PUSH-03, PUSH-04, PUSH-05, PUSH-06, PUSH-07
**Success Criteria** (what must be TRUE):
  1. Push commands to all 4 targets: output files match expected format (frontmatter for OpenCode, TOML for Gemini, flat markdown for Codex, nested JSON for Claude)
  2. Push agents, skills, settings, MCP, and instructions each verified against expected output for all 4 targets
  3. Push with `--force --delete` removes non-canonical items from targets (verified by checking target directory contents post-push)
  4. All 24 push cells (6 types × 4 targets) covered by at least one assertion
**Plans**: TBD

### Phase 12: Pull E2E Tests
**Goal**: E2E tests verify that pulling each of the 6 config types from all 4 real CLI targets produces correct canonical format — 24 pull test cells covered
**Depends on**: Phase 10
**Requirements**: PULL-01, PULL-02, PULL-03, PULL-04, PULL-05, PULL-06, PULL-07
**Success Criteria** (what must be TRUE):
  1. Pull commands from all 4 targets: canonical output matches expected format (markdown with frontmatter, no target-specific syntax)
  2. Pull agents, skills, settings, MCP, and instructions each verified against expected canonical output from all 4 targets
  3. Pull overwrites existing canonical items when target has newer/different content (verified by pre-populating canonical dir)
  4. All 24 pull cells (6 types × 4 targets) covered by at least one assertion
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → ... → 9 → 10 → 11 → 12

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-02-20 |
| 2. Renderers + Secrets | v1.0 | 3/3 | Complete | 2026-02-20 |
| 3. Diff Engine + CLI | v1.0 | 5/5 | Complete | 2026-02-21 |
| 4. CLI Subcommands + Test Fixes | v1.0 | 2/2 | Complete | 2026-02-21 |
| 5. Dead Code Cleanup + Integration Hygiene | v1.0 | 3/3 | Complete | 2026-02-22 |
| 6. Flatten Canonical Structure | v2.0 | 2/2 | Complete | 2026-02-24 |
| 7. Unify Instructions | v2.0 | 2/2 | Complete | 2026-02-24 |
| 8. TOOLS.md + Repo Rename | v2.0 | 2/2 | Complete | 2026-02-24 |
| 9. Verification Closure + Doc Cleanup | v2.0 | 2/2 | Complete | 2026-02-25 |
| 10. Fixtures Infrastructure + Test Health | v3.0 | 0/? | Not started | - |
| 11. Push E2E Tests | v3.0 | 0/? | Not started | - |
| 12. Pull E2E Tests | v3.0 | 0/? | Not started | - |
