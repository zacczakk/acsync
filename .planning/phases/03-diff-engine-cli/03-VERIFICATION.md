---
phase: 03-diff-engine-cli
verified: 2026-02-21T18:00:00Z
status: gaps_found
score: 5/7 success criteria verified
re_verification: false
gaps:
  - truth: "CLI-01 (`render` subcommand) and CLI-02 (`diff` subcommand) exist as named commands"
    status: failed
    reason: "No dedicated `render` or `diff` subcommand registered. REQUIREMENTS.md lists CLI-01 as `render` and CLI-02 as `diff` as separate subcommands, but only `check`, `push`, and `pull` exist. The SUMMARY claims CLI-01/CLI-02 complete by mapping them to push/check semantics respectively, but the named subcommands required by the spec are absent."
    artifacts:
      - path: "src/cli/index.ts"
        issue: "Only registers check, push, pull — no render or diff command"
    missing:
      - "Either: (a) add `acsync render` subcommand for CLI-01 and rename `check` to `diff` (or add `diff` alias) for CLI-02; OR (b) formally document in REQUIREMENTS.md that render=push and diff=check (requirement collapse)"

  - truth: "CLI-05: `--json` flag exists on all subcommands for structured output"
    status: failed
    reason: "No `--json` flag on any subcommand. The implementation inverts the requirement: JSON is the default (no flag) and `--pretty` produces human output. This is a documented design decision in 03-CONTEXT.md ('agent-first design: JSON default') but it contradicts CLI-05 which specifies a `--json` flag. REQUIREMENTS.md is not updated to reflect the design change."
    artifacts:
      - path: "src/cli/check.ts"
        issue: "Has --pretty flag only; no --json flag"
      - path: "src/cli/push.ts"
        issue: "Has --pretty flag only; no --json flag"
    missing:
      - "Either: (a) add `--json` as an explicit flag (can be identity/no-op since JSON is default) to satisfy the spec; OR (b) update REQUIREMENTS.md CLI-05 to read 'JSON is default output; `--pretty` flag produces human-readable output'"

  - truth: "MCPorter hybrid setup is operational: 4 servers routed through mcporter"
    status: partial
    reason: "`~/.mcporter/mcporter.json` does not exist. The 03-CONTEXT.md explicitly defers mcporter.json creation as a human task outside acsync's scope. The 3 native MCP servers are rendered correctly. But SC7 states '4 servers routed through mcporter' which requires the config file. This is a human-verification item that was never completed."
    artifacts:
      - path: "~/.mcporter/mcporter.json"
        issue: "File does not exist — mcporter not configured"
    missing:
      - "Human action: create ~/.mcporter/mcporter.json with chrome-devtools, foundry-mcp, liquid-carbon, shadcn entries"

  - truth: "All tests pass (no regressions)"
    status: failed
    reason: "3 test failures exist: (1) rollback reverse-order bug — `createBackup` uses `Date.now()` for temp filename uniqueness; when called in tight succession timestamps collide → b1 and b2 get the same backupPath, overwriting b1's backup with b2's content → restoreAll cannot restore to v1. (2/3) Two BaseAdapter skill tests expect `ralph-tui-create-beads` in `~/.claude/skills/` but that skill doesn't exist (only `vercel-react-best-practices` and `web-design-guidelines` are present)."
    artifacts:
      - path: "src/core/rollback.ts"
        issue: "createBackup uses Date.now() for filename uniqueness — can collide when called multiple times in the same millisecond"
      - path: "src/core/__tests__/rollback.test.ts"
        issue: "'processes backups in reverse order' test fails: expected 'v1', received 'v2'"
      - path: "src/adapters/__tests__/skills.test.ts"
        issue: "Tests reference ralph-tui-create-beads skill that doesn't exist in ~/.claude/skills/"
    missing:
      - "Fix createBackup to use crypto.randomBytes or performance.now() for unique filenames"
      - "Fix skills.test.ts to reference skills that actually exist in the test environment, or use a temp dir"

human_verification:
  - test: "Run acsync check then push end-to-end"
    expected: "check exits 2 with drift, push exits 0, second check exits 0"
    why_human: "Integration test exercising real filesystem writes to ~/.claude, ~/.config/opencode, etc."
  - test: "Verify tavily.json renders correctly for all 4 CLIs"
    expected: "All CLIs (claude, gemini, codex, opencode) have tavily in their MCP config after push"
    why_human: "Requires running push against real target dirs and inspecting output"
  - test: "Verify MCPorter setup (if mcporter.json is created)"
    expected: "4 servers (chrome-devtools, foundry-mcp, liquid-carbon, shadcn) accessible via mcporter"
    why_human: "Requires human to create ~/.mcporter/mcporter.json and test mcporter invocations"
---

# Phase 3: Diff Engine + CLI Verification Report

**Phase Goal:** End-to-end CLI works — diff, render, push, check with proper output and exit codes. Rollback replaces Phase 1's backup-only approach with full restore-on-failure semantics.
**Verified:** 2026-02-21T18:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Success Criteria (from ROADMAP.md)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `check` subcommand detects drift, exits with code 2 | ✓ VERIFIED | `src/cli/check.ts:23` `process.exit(result.hasDrift ? 2 : 0)` |
| 2 | `push` renders + writes all configs with rollback on failure | ✓ VERIFIED | `orchestrator.ts:687` `restoreAll(targetBackups)` on error |
| 3 | `--dry-run` shows plan without writing | ✓ VERIFIED | `push.ts:48` early return on dryRun; `orchestrator.ts:557` formatDryRunResult |
| 4 | JSON is default output; `--pretty` produces human-readable colored text | ✓ VERIFIED | `orchestrator.ts:520` `formatCheckResult(diffs, options.pretty ?? false)`; picocolors installed |
| 5 | `--target` and `--type` flags scope operations; exit codes 0/1/2 | ✓ VERIFIED | `push.ts:20-21` flags; `check.ts:23`, `push.ts:65-77` exit codes |
| 6 | Push failure triggers full rollback | ✓ VERIFIED | `orchestrator.ts:687-688` `restoreAll(targetBackups); rolledBack = true` |
| 7 | MCPorter hybrid: 3 native MCP servers rendered, 4 via mcporter | ✗ PARTIAL | 3 native verified (`configs/common/mcp/`); `~/.mcporter/mcporter.json` absent |

**Score:** 5/7 success criteria verified (SC7 partial; test suite has 3 failures)

---

## Required Artifacts

### Plan 03-01: Diff Engine + Rollback + Formatters

| Artifact | Status | Details |
|----------|--------|---------|
| `src/core/manifest.ts` (118 lines) | ✓ VERIFIED | Exports: `getManifestPath`, `createEmptyManifest`, `loadManifest`, `saveManifest`, `updateManifestItem`, `getManifestHash` |
| `src/core/diff.ts` (124 lines) | ✓ VERIFIED | Exports: `compareHashes`, `calculateDiff`; reads manifest via `getManifestHash` (line 3+81) |
| `src/core/rollback.ts` (117 lines) | ✓ VERIFIED | Exports: `createBackup`, `restoreBackup`, `cleanupBackup`, `restoreAll`, `cleanupAll`; uses `atomicWrite` (line 4+74) |
| `src/core/formatter.ts` (317 lines) | ✓ VERIFIED | Exports: `formatDiffJson`, `formatDiffPretty`, `formatPushResult`, `formatCheckResult`, `formatDryRunResult` |
| `src/types.ts` | ✓ VERIFIED | Contains `Manifest`, `ManifestItem`, `TargetStatus`, `Operation`, `DiffResult`, `OperationType`, `ItemType` |

### Plan 03-02: CLI Shell + Orchestrator

| Artifact | Status | Details |
|----------|--------|---------|
| `src/cli/index.ts` (35 lines) | ✓ VERIFIED | Registers check, push, pull; exports `program`; `bin.acsync` in package.json |
| `src/cli/check.ts` (30 lines) | ✓ VERIFIED | Exports `checkCommand`; `--pretty`, `--target`, `--type`; exits 2 on drift |
| `src/cli/push.ts` (85 lines) | ✓ VERIFIED | Exports `pushCommand`; `--dry-run`, `--force`, `--delete`, `--target`, `--type`; delegates to `runPush` |
| `src/cli/orchestrator.ts` (1027 lines) | ✓ VERIFIED | Exports `runCheck`, `runPush`, `runPull`, `runPullAll`; wires diff+manifest+rollback pipeline |

### Plan 03-03: MCPorter + MCP Config

| Artifact | Status | Details |
|----------|--------|---------|
| `configs/common/mcp/context7.json` | ✓ VERIFIED | HTTP transport; CONTEXT7_API_KEY env var |
| `configs/common/mcp/tavily.json` | ✓ VERIFIED | stdio transport; Tavily enabled for all CLIs (no disabled_for) |
| `configs/common/mcp/sequential-thinking.json` | ✓ VERIFIED | `"enabled": false` present |
| AGENTS.md mcporter docs | ✓ VERIFIED | Lines 188-193: mcporter tool section with usage, servers, config |
| `~/.mcporter/mcporter.json` | ✗ MISSING | Not created — explicitly deferred as human task in 03-CONTEXT.md |

### Plan 03-04: Claude Path Fix + --delete Flag

| Artifact | Status | Details |
|----------|--------|---------|
| `src/adapters/path-resolver.ts` | ✓ VERIFIED | `rawCommandsDir` claude-code case returns `~/.claude/commands/` (no zz/ suffix at line 72) |
| `src/types.ts` `SyncOptions.deleteStale` | ✓ VERIFIED | Line 31: `deleteStale?: boolean` |
| `src/cli/push.ts` `--delete` flag | ✓ VERIFIED | Line 24: `.option('--delete', ...)` |
| `src/cli/orchestrator.ts` delete gate | ✓ VERIFIED | Line 659: `if (options.deleteStale) {` |

### Plan 03-05: Skills for Gemini/Codex

| Artifact | Status | Details |
|----------|--------|---------|
| `src/adapters/gemini.ts` `skills: true` | ✓ VERIFIED | Line 18: `return { ..., skills: true }` |
| `src/adapters/codex.ts` `skills: true` | ✓ VERIFIED | Line 22: `return { ..., skills: true }` |
| `src/cli/orchestrator.ts` (no injectSecrets) | ✓ VERIFIED | grep for `injectSecrets`/`loadSecrets` returns 0 matches |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `orchestrator.ts` | `core/diff.ts` | `calculateDiff` call | ✓ WIRED | Line 8 import + line 504 call |
| `orchestrator.ts` | `core/rollback.ts` | `createBackup`/`restoreAll` | ✓ WIRED | Line 9 import + lines 601, 665, 670, 687 calls |
| `orchestrator.ts` | `core/manifest.ts` | `loadManifest`/`saveManifest` | ✓ WIRED | Line 7 import + lines 338, 532 (load), 706 (save) |
| `core/diff.ts` | `core/manifest.ts` | `getManifestHash` for 3-way compare | ✓ WIRED | Line 3 import + line 81 call |
| `core/rollback.ts` | `infra/atomic-write.ts` | `atomicWrite` for crash-safe restore | ✓ WIRED | Line 4 import + line 74 call |
| `core/formatter.ts` | `types.ts` | `DiffResult` type | ✓ WIRED | Line 2 import: `import type { DiffResult, ... }` |
| `src/cli/push.ts` | `src/cli/orchestrator.ts` | `runPush` delegation | ✓ WIRED | Line 4 import + line 49 call |
| `src/cli/index.ts` | `src/cli/check.ts` | `checkCommand` registration | ✓ WIRED | Line 3 import + line 12 `addCommand` |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| DIFF-02 | 03-01, 03-03 | Read/write manifest file (JSON, tracks last-synced hashes per target) | ✓ SATISFIED | `src/core/manifest.ts` full CRUD; `.acsync/manifest.json` path |
| DIFF-03 | 03-01, 03-03, 03-04 | Compare source vs target vs manifest → create/update/skip operations | ✓ SATISFIED | `src/core/diff.ts:compareHashes` 3-way logic; `calculateDiff` produces operations array |
| DIFF-04 | 03-01 | Output diff as structured JSON | ✓ SATISFIED | `formatter.ts:formatDiffJson` returns JSON.stringify; JSON is default output mode |
| DIFF-05 | 03-01 | Output diff as human-readable colored text | ✓ SATISFIED | `formatter.ts:formatDiffPretty` uses picocolors; `--pretty` flag |
| FILE-03 | 03-02 | Dry-run mode (compute diff, show plan, write nothing) | ✓ SATISFIED | `push.ts:48` early return; `orchestrator.ts:557` formatDryRunResult |
| FILE-04 | 03-01 | Rollback on push failure | ✓ SATISFIED | `rollback.ts:restoreAll`; `orchestrator.ts:687-688` restores + sets rolledBack |
| CLI-01 | 03-02 | `render` subcommand | ✗ BLOCKED | No `render` named subcommand exists; SUMMARY claims push satisfies this (disputed) |
| CLI-02 | 03-02 | `diff` subcommand | ✗ BLOCKED | No `diff` named subcommand exists; SUMMARY claims check satisfies this (disputed) |
| CLI-03 | 03-02 | `push` subcommand | ✓ SATISFIED | `src/cli/push.ts`; registered in index.ts |
| CLI-04 | 03-02, 03-05 | `check` subcommand — exit non-zero on drift | ✓ SATISFIED | `src/cli/check.ts`; exits 2 on drift |
| CLI-05 | 03-02, 03-04 | `--json` flag on all subcommands | ✗ BLOCKED | No `--json` flag; design chose JSON-as-default + `--pretty` flag instead (undocumented req change) |
| CLI-06 | 03-02 | `--dry-run` flag on push | ✓ SATISFIED | `push.ts:22` `.option('--dry-run', ...)` |
| CLI-07 | 03-02, 03-04 | `--target` flag | ✓ SATISFIED | `check.ts:9` and `push.ts:20` both have `-t, --target` |
| CLI-08 | 03-02 | `--type` flag | ✓ SATISFIED | `check.ts:10` and `push.ts:21` both have `--type` |
| CLI-09 | 03-02 | Exit codes: 0=success, 1=error, 2=drift | ✓ SATISFIED | `check.ts:23,28`; `push.ts:65,71,77,82` |

**ORPHANED REQUIREMENTS:** RNDR-13, SECR-01 are completed in plan 03-05 but not listed in the phase-level requirements passed to this verification. They appear in 03-05-SUMMARY `requirements-completed` — no gap, just out-of-scope for this verify call.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/core/rollback.ts` | 31 | `Date.now()` for backup filename uniqueness | ✗ BUG | Timestamps collide in tight loops → backup paths overwritten → restoreAll restores wrong content |
| `src/adapters/__tests__/skills.test.ts` | 57, 71, 102 | Test expects `ralph-tui-create-beads` to exist in `~/.claude/skills/` | ⚠️ WARNING | Test is environment-coupled; skill absent → 3 test failures |
| `src/cli/orchestrator.ts` | 103, 131, 156, 189, 217 | `return []` in discovery error handlers | ℹ️ INFO | Graceful degradation; intentional for missing canonical dirs |

---

## Test Suite Status

```
432 pass
3 fail
435 total
```

**Failures:**
1. `restoreAll > processes backups in reverse order` — rollback.test.ts:179 — root cause: `Date.now()` collision in `createBackup` produces identical backupPaths when called in same millisecond; b2 overwrites b1's backup file, so restoring b1 restores b2's content
2. `BaseAdapter.listExistingSkillNames > returns names of subdirectories containing SKILL.md` — skills.test.ts:57 — `ralph-tui-create-beads` not in `~/.claude/skills/`
3. `BaseAdapter.readSkill > returns empty supportFiles for skill with no extra files` — skills.test.ts:102 — same cause

---

## Human Verification Required

### 1. End-to-End push pipeline

**Test:** Run `bun src/cli/index.ts check --pretty`, note exit code; run `bun src/cli/index.ts push --force --pretty`; run check again
**Expected:** First check exits 2 (or 0 if already synced); push exits 0; second check exits 0
**Why human:** Integration test writes to real `~/.claude`, `~/.config/opencode`, `~/.gemini`, `~/.codex` dirs

### 2. Tavily rendered for all CLIs

**Test:** After push, inspect `~/.claude/settings.json`, `~/.config/opencode/settings.json`, `~/.gemini/config.yaml`, and Codex config for Tavily MCP entry
**Expected:** All 4 CLIs have Tavily present (with ${TAVILY_API_KEY} placeholder)
**Why human:** Requires inspecting real target config files post-push

### 3. MCPorter setup (if creating mcporter.json)

**Test:** Create `~/.mcporter/mcporter.json` per MCPORTER_ANALYSIS.md, then run `mcporter list` and `mcporter call chrome-devtools.screenshot {}`
**Expected:** 4 servers visible; chrome-devtools responds
**Why human:** Requires manual config creation and mcporter tool invocation

---

## Gaps Summary

**4 gaps** blocking full verification:

1. **CLI-01 / CLI-02 naming gap** — No dedicated `render` or `diff` subcommands. The codebase delivers the *functionality* of render (via push) and diff (via check), but not as named commands. REQUIREMENTS.md lists them as separate subcommands. Resolution: either add the named commands or formally update REQUIREMENTS.md to document the CLI-01/CLI-02→push/check collapse.

2. **CLI-05 flag inversion** — The spec says `--json` flag; the implementation uses JSON-as-default with `--pretty` flag. This is arguably better UX (agent-first design), but it's a spec deviation that should be documented. REQUIREMENTS.md CLI-05 should be updated to reflect the actual contract.

3. **MCPorter config absent** — `~/.mcporter/mcporter.json` not created. SC7 is half-met: 3 native servers render correctly; 4-server mcporter routing requires human setup. The CONTEXT.md correctly defers this, but the success criterion as written is not fully met.

4. **3 test failures** — 1 genuine bug (Date.now collision in rollback), 2 environment-coupled tests (ralph-tui-create-beads skill missing). The rollback bug affects real push operations where multiple files are written to the same target in the same millisecond.

**Not blocked:** Core diff engine (DIFF-02/03/04/05), rollback semantics (FILE-04), dry-run (FILE-03), push (CLI-03), check (CLI-04), exit codes (CLI-09), --dry-run (CLI-06), --target (CLI-07), --type (CLI-08) — all verified against actual code.

---

*Verified: 2026-02-21T18:00:00Z*
*Verifier: Claude (gsd-verifier)*
