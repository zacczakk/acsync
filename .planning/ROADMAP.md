# Roadmap: Agent Config Sync CLI

## Overview

Build a deterministic CLI that renders canonical agent configs to 4 target CLI formats, detects drift via hash-based diffs, and pushes changes with atomic writes and secret injection. Three phases: infrastructure foundations, all renderers + secret handling, then diff engine + CLI shell.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Foundation** - Types, infra (atomic writes, backup, hashing), format parsers, exclusion filters (completed 2026-02-20)
- [x] **Phase 2: Renderers + Secrets** - All config rendering for 4 targets + secret injection + env var conversion (completed 2026-02-20)
- [x] **Phase 3: Diff Engine + CLI** - Manifest, 3-way diff, CLI subcommands, output formats, dry-run (completed 2026-02-20)
- [ ] **Phase 4: CLI Subcommands + Test Fixes** - Add render/diff subcommands, --json flag, fix test failures (gap closure)
- [ ] **Phase 5: Dead Code Cleanup + Integration Hygiene** - Remove dead exports, eliminate double-backup, wire atomicWrite into pull, split orchestrator (gap closure)

## Phase Details

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
- [ ] 01-01-PLAN.md — Types, errors, exclusion filter, hash, backup, atomic write + tests
- [ ] 01-02-PLAN.md — Format parsers (JSON, JSONC, TOML, Markdown frontmatter) + round-trip tests

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
**Plans:** 3 plans

Plans:
- [ ] 02-01-PLAN.md — Secrets (env-loader, injector, EnvVarTransformer) + types + BaseAdapter/PathResolver
- [ ] 02-02-PLAN.md — Command + agent renderers (4 adapters × 2 methods = 8 render functions)
- [ ] 02-03-PLAN.md — MCP rendering (4 targets) + instructions + skills

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
- [ ] 03-01-PLAN.md — Manifest manager + 3-way diff engine + rollback + output formatters (types, compareHashes/calculateDiff, BackupInfo/restoreAll, JSON+pretty formatters via picocolors)
- [ ] 03-02-PLAN.md — CLI shell + sync orchestrator (Commander.js acsync check/push, --pretty/--dry-run/--force/--target/--type, push orchestration with rollback, exit codes 0/1/2)
- [ ] 03-03-PLAN.md — MCPorter hybrid setup + E2E verification (trim canonical MCP to 3 servers, update AGENTS.md + addendums, exercise full acsync check→push pipeline)

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

Plans:
- [ ] 04-01-PLAN.md — Add render + diff subcommands, --json flag, fix 3 test failures

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

Plans:
- [ ] 05-01-PLAN.md — Remove dead exports, eliminate double-backup, wire atomicWrite into pull, split orchestrator

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete | 2026-02-20 |
| 2. Renderers + Secrets | 3/3 | Complete | 2026-02-20 |
| 3. Diff Engine + CLI | 5/5 | Complete | 2026-02-21 |
| 4. CLI Subcommands + Test Fixes | 0/1 | Pending | — |
| 5. Dead Code Cleanup + Integration Hygiene | 0/1 | Pending | — |
