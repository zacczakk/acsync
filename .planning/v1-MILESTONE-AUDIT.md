---
milestone: v1
audited: 2026-02-21T19:00:00Z
status: gaps_found
scores:
  requirements: 34/37
  phases: 3/3
  integration: 26/37
  flows: 3/3
gaps:
  requirements:
    - id: "CLI-01"
      status: "unsatisfied"
      phase: "Phase 3"
      claimed_by_plans: ["03-02-PLAN.md"]
      completed_by_plans: ["03-02-SUMMARY.md"]
      verification_status: "BLOCKED"
      evidence: "No `render` subcommand exists. Only check, push, pull registered in src/cli/index.ts. SUMMARY claims push satisfies CLI-01 but the spec requires a named `render` command."
    - id: "CLI-02"
      status: "unsatisfied"
      phase: "Phase 3"
      claimed_by_plans: ["03-02-PLAN.md"]
      completed_by_plans: ["03-02-SUMMARY.md"]
      verification_status: "BLOCKED"
      evidence: "No `diff` subcommand exists. SUMMARY claims check satisfies CLI-02 but the spec requires a named `diff` command."
    - id: "CLI-05"
      status: "unsatisfied"
      phase: "Phase 3"
      claimed_by_plans: ["03-02-PLAN.md", "03-04-PLAN.md"]
      completed_by_plans: ["03-02-SUMMARY.md", "03-04-SUMMARY.md"]
      verification_status: "BLOCKED"
      evidence: "No --json flag exists. Design chose JSON-as-default with --pretty flag instead. Spec inversion not documented in REQUIREMENTS.md."
  integration:
    - "Secrets pipeline (loadSecrets, injectSecrets) fully implemented in Phase 2 but never called by Phase 3 orchestrator. SECR-01/SECR-02 pass at module level but are dead code at integration level."
    - "hashFile/hashDirectory from Phase 1 never imported by Phase 3; orchestrator reimplements SHA-256 inline."
    - "pruneBackups from Phase 1 never called; backup files accumulate unboundedly."
    - "Error severity system (shouldRollback, isSyncError, getErrorSeverity) unused; orchestrator always rolls back on any error."
    - "Double-backup on push: rollback.ts createBackup + atomicWrite's internal backupFile create redundant copies."
    - "pull uses Bun.write instead of atomicWrite — no crash-safety on reverse sync."
  flows: []
tech_debt:
  - phase: "01-foundation"
    items:
      - "pruneBackups and createBackupDir are dead exports — never called by any consumer"
      - "hashFile and hashDirectory are dead exports — orchestrator reimplements hashing inline"
  - phase: "02-renderers-secrets"
    items:
      - "loadSecrets, injectSecrets, redactSecrets are dead exports — never called by orchestrator"
      - "SecretError class defined but never constructed"
  - phase: "03-diff-engine-cli"
    items:
      - "rollback.ts createBackup uses Date.now() for filename uniqueness — collides in tight loops (1 test failure)"
      - "skills.test.ts references ralph-tui-create-beads skill that doesn't exist in test environment (2 test failures)"
      - "3 test failures total: 432 pass, 3 fail"
      - "orchestrator.ts is 1027 lines — exceeds 500 LOC guideline"
      - "shouldRollback/isSyncError/getErrorSeverity error utilities are dead code"
      - "DiffError class defined but never constructed"
      - "Double-backup: rollback createBackup + atomicWrite backupFile create redundant copies"
      - "pull uses Bun.write instead of atomicWrite — inconsistent safety guarantees"
      - "MCPorter config (~/.mcporter/mcporter.json) not created — requires human setup"
---

# v1 Milestone Audit Report

**Milestone:** Agent Config Sync CLI v1
**Audited:** 2026-02-21T19:00:00Z
**Status:** gaps_found
**Score:** 34/37 requirements satisfied

---

## Executive Summary

The Agent Config Sync CLI delivers core functionality: deterministic rendering of canonical configs to 4 CLI targets, 3-way diff engine, push with rollback, and check for drift detection. All 3 phases completed with 432 passing tests. However, 3 requirements have spec deviations that need resolution (missing named subcommands, inverted flag design), and the secrets pipeline — while fully built and tested — is dead code at the integration level.

---

## Requirements Coverage (3-Source Cross-Reference)

### Phase 1: Foundation (5/5 satisfied)

| REQ | VERIFICATION | SUMMARY | REQUIREMENTS.md | Final |
|-----|-------------|---------|-----------------|-------|
| DIFF-01 | passed | 01-01, 01-02 | `[x]` | **satisfied** |
| FILE-01 | passed | 01-01, 01-02 | `[x]` | **satisfied** |
| FILE-02 | passed | 01-01 | `[x]` | **satisfied** |
| EXCL-01 | passed | 01-01 | `[x]` | **satisfied** |
| EXCL-02 | passed | 01-01 | `[x]` | **satisfied** |

### Phase 2: Renderers + Secrets (17/17 satisfied)

| REQ | VERIFICATION | SUMMARY | REQUIREMENTS.md | Final |
|-----|-------------|---------|-----------------|-------|
| RNDR-01 | passed | 02-02 | `[x]` | **satisfied** |
| RNDR-02 | passed | 02-02 | `[x]` | **satisfied** |
| RNDR-03 | passed | 02-02 | `[x]` | **satisfied** |
| RNDR-04 | passed | 02-02 | `[x]` | **satisfied** |
| RNDR-05 | passed | 02-02 | `[x]` | **satisfied** |
| RNDR-06 | passed | 02-02 | `[x]` | **satisfied** |
| RNDR-07 | passed | 02-02 | `[x]` | **satisfied** |
| RNDR-08 | passed | 02-02 | `[x]` | **satisfied** |
| RNDR-09 | passed | 02-03 | `[x]` | **satisfied** |
| RNDR-10 | passed | 02-03 | `[x]` | **satisfied** |
| RNDR-11 | passed | 02-03 | `[x]` | **satisfied** |
| RNDR-12 | passed | 02-03 | `[x]` | **satisfied** |
| RNDR-13 | passed | 02-03, 03-05 | `[x]` | **satisfied** |
| RNDR-14 | passed | 02-03 | `[x]` | **satisfied** |
| SECR-01 | passed | 02-01, 03-05 | `[x]` | **satisfied** |
| SECR-02 | passed | 02-01 | `[x]` | **satisfied** |
| SECR-03 | passed | 02-01 | `[x]` | **satisfied** |

Note: SECR-01/SECR-02 pass at module level (code exists, tests pass) but `loadSecrets`/`injectSecrets` are never called by the orchestrator. The design pivoted to writing env var references instead of injecting values. This is likely correct behavior but the requirement text is misleading.

### Phase 3: Diff Engine + CLI (12/15 satisfied)

| REQ | VERIFICATION | SUMMARY | REQUIREMENTS.md | Final |
|-----|-------------|---------|-----------------|-------|
| DIFF-02 | passed | 03-01, 03-03 | `[x]` | **satisfied** |
| DIFF-03 | passed | 03-01, 03-03, 03-04 | `[x]` | **satisfied** |
| DIFF-04 | passed | 03-01 | `[x]` | **satisfied** |
| DIFF-05 | passed | 03-01 | `[x]` | **satisfied** |
| FILE-03 | passed | 03-02 | `[x]` | **satisfied** |
| FILE-04 | passed | 03-01 | `[x]` | **satisfied** |
| CLI-01 | **BLOCKED** | 03-02 | `[x]` | **unsatisfied** |
| CLI-02 | **BLOCKED** | 03-02 | `[x]` | **unsatisfied** |
| CLI-03 | passed | 03-02 | `[x]` | **satisfied** |
| CLI-04 | passed | 03-02, 03-05 | `[x]` | **satisfied** |
| CLI-05 | **BLOCKED** | 03-02, 03-04 | `[x]` | **unsatisfied** |
| CLI-06 | passed | 03-02 | `[x]` | **satisfied** |
| CLI-07 | passed | 03-02, 03-04 | `[x]` | **satisfied** |
| CLI-08 | passed | 03-02 | `[x]` | **satisfied** |
| CLI-09 | passed | 03-02 | `[x]` | **satisfied** |

---

## Unsatisfied Requirements Detail

### CLI-01: `render` subcommand (Phase 3)

**Spec:** "render subcommand -- render a canonical config to a specific target format, output to stdout or file"
**Actual:** No `render` command registered. Only `check`, `push`, `pull` exist in `src/cli/index.ts`.
**SUMMARY claim:** 03-02-SUMMARY lists CLI-01 as complete, mapping it to push semantics.
**Resolution options:**
- (a) Add `acsync render` subcommand that renders a single item to stdout
- (b) Update REQUIREMENTS.md to document that render is subsumed by push

### CLI-02: `diff` subcommand (Phase 3)

**Spec:** "diff subcommand -- show what would change for one or all targets"
**Actual:** `check` subcommand provides this functionality but under a different name.
**Resolution options:**
- (a) Add `acsync diff` as alias for `check`
- (b) Update REQUIREMENTS.md to document that diff = check

### CLI-05: `--json` flag (Phase 3)

**Spec:** "--json flag on all subcommands for structured output"
**Actual:** JSON is the default output format; `--pretty` flag produces human-readable text. Design documented in 03-CONTEXT.md as "agent-first design."
**Resolution options:**
- (a) Add `--json` as a no-op flag (documentation/discoverability value)
- (b) Update REQUIREMENTS.md CLI-05 to read "JSON is default output; --pretty flag for human-readable"

---

## Cross-Phase Integration Report

### Wiring Health

| Metric | Value |
|--------|-------|
| Phase 1 exports consumed | 8/14 (57%) |
| Phase 2 exports consumed | 7/10 (70%) |
| Phase 3 internal wiring | 17/17 (100%) |
| Dead exports | 9 functions + 2 error classes + 3 utilities |
| E2E flows complete | 3/3 |

### E2E Flows Verified

1. **`acsync check`** (detect drift): CLI -> orchestrator -> exclusion filter -> manifest -> adapters -> diff -> formatter -> exit code. **COMPLETE.**
2. **`acsync push`** (render + write): CLI -> orchestrator -> check -> backup -> adapters -> atomicWrite -> manifest update -> rollback on error. **COMPLETE.**
3. **`acsync pull`** (reverse sync): CLI -> orchestrator -> adapters -> parse targets -> write canonical. **COMPLETE.**

### Integration Findings

1. **Secrets pipeline floating (SECR-01, SECR-02):** `loadSecrets` -> `injectSecrets` -> `redactSecrets` chain is built and tested but the orchestrator never calls it. The design correctly writes `${VAR}` placeholders and lets CLIs resolve env vars at runtime. But the modules are dead code at integration level.

2. **Hashing reimplemented (DIFF-01):** Orchestrator uses inline `createHash('sha256')` instead of importing `hashFile` from Phase 1. Justified — orchestrator hashes in-memory strings, `hashFile` reads from disk. But creates dead exports.

3. **Backup accumulation (FILE-02):** `pruneBackups` is never called. `atomicWrite` creates backups on every write via `backupFile` but nothing prunes them. Additionally, push creates a second backup via `rollback.ts` `createBackup`. Double-backup with no pruning.

4. **Error severity unused (FILE-04):** `shouldRollback`/`isSyncError`/`getErrorSeverity` form a complete classification system that the orchestrator ignores. It catches all errors and always rolls back. Simpler and safer, but makes the severity infrastructure dead code.

5. **Pull lacks atomicWrite:** `runPull` uses `Bun.write` directly instead of `atomicWrite`. Less critical (writes to git-tracked project dir) but inconsistent with push's safety posture.

---

## Phase Verification Summary

| Phase | Status | Score | Tests | Gaps |
|-------|--------|-------|-------|------|
| 1. Foundation | passed | 10/10 truths | 64 pass, 0 fail | None |
| 2. Renderers + Secrets | passed | 14/14 truths | 219 pass, 0 fail | None |
| 3. Diff Engine + CLI | gaps_found | 5/7 criteria | 432 pass, 3 fail | CLI-01, CLI-02, CLI-05 blocked; 3 test failures |

### Test Failures (Phase 3)

1. **rollback.ts Date.now() collision:** `createBackup` uses `Date.now()` for filename uniqueness. When called in tight succession (same millisecond), backup paths collide and overwrite. Fix: use `crypto.randomBytes` or `performance.now()`.
2. **skills.test.ts environment coupling (x2):** Tests expect `ralph-tui-create-beads` skill in `~/.claude/skills/` which doesn't exist. Fix: use temp directory or reference existing skills.

---

## Tech Debt Inventory

### Phase 1: Foundation
- `pruneBackups` and `createBackupDir` are dead exports
- `hashFile` and `hashDirectory` are dead exports (reimplemented inline by orchestrator)

### Phase 2: Renderers + Secrets
- `loadSecrets`, `injectSecrets`, `redactSecrets` are dead exports (never called by orchestrator)
- `SecretError` class defined but never constructed

### Phase 3: Diff Engine + CLI
- `orchestrator.ts` is 1027 lines (exceeds 500 LOC guideline)
- `shouldRollback`/`isSyncError`/`getErrorSeverity` error utilities are dead code
- `DiffError` class defined but never constructed
- Double-backup per push (rollback + atomicWrite) with no pruning
- `pull` uses `Bun.write` instead of `atomicWrite`
- MCPorter config (`~/.mcporter/mcporter.json`) not created (requires human setup)
- `Date.now()` collision bug in rollback `createBackup`

**Total: 14 items across 3 phases**

---

## Orphan Check

All 37 v1 requirement IDs from REQUIREMENTS.md traceability table appear in at least one phase VERIFICATION.md. **No orphaned requirements.**

---

*Audited: 2026-02-21T19:00:00Z*
*Auditor: OpenCode (gsd-audit-milestone)*
