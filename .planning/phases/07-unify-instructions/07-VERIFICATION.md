---
phase: 07-unify-instructions
verified: 2026-02-24T14:30:00Z
status: passed
score: 7/7 must-haves verified
---

# Phase 7: Unify Instructions Verification Report

**Phase Goal:** Single canonical `configs/instructions/AGENTS.md` replaces base + 4 addendums — rendering pipeline simplified to single-file passthrough, all 4 targets receive correct output filenames
**Verified:** 2026-02-24T14:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | configs/instructions/AGENTS.md exists with ## CLI-Specific Notes section containing merged addendum content | ✓ VERIFIED | 375-line file with `## CLI-Specific Notes` at L280, subsections `### Claude Code` (L282), `### OpenCode` (L308), `### Gemini` (L336), `### Codex` (L356) |
| 2 | readCanonicalInstructions returns single string content (no base/addendum split) | ✓ VERIFIED | `canonical.ts:156-165` — signature `(projectDir: string): Promise<string \| null>`, reads single file from `INSTRUCTIONS_DIR/AGENTS.md` |
| 3 | renderInstructions accepts single content param (no addendum) | ✓ VERIFIED | `base.ts:40` interface `renderInstructions(content: string): string`; `base.ts:207-209` implementation returns `content` (identity passthrough) |
| 4 | path-resolver returns correct output filenames: CLAUDE.md, AGENTS.md, AGENTS.md, AGENTS.md for claude/opencode/gemini/codex | ✓ VERIFIED | `path-resolver.ts:97-104` — `claude-code: CLAUDE.md`, `opencode: AGENTS.md`, `gemini: AGENTS.md`, `codex: AGENTS.md` |
| 5 | All CLI commands (check, push, render, diff) use simplified single-content instruction flow | ✓ VERIFIED | All 4 CLI files call `readCanonicalInstructions(projectDir)` (no target param) and `adapter.renderInstructions(content)` (single param). Grep confirms 0 hits for old 2-param pattern. |
| 6 | No per-CLI addendum files exist in configs/instructions/ | ✓ VERIFIED | `configs/instructions/` contains only `AGENTS.md`. `claude.md`, `opencode.md`, `gemini.md`, `codex.md` all confirmed NOT_FOUND. |
| 7 | No AGENTS.md at repo root | ✓ VERIFIED | Repo-root `AGENTS.md` confirmed NOT_FOUND. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `configs/instructions/AGENTS.md` | Unified instructions with CLI-Specific Notes section | ✓ VERIFIED | 375 lines, contains `## CLI-Specific Notes` with all 4 CLI subsections |
| `src/cli/canonical.ts` | Simplified readCanonicalInstructions reading single file | ✓ VERIFIED | Exports `readCanonicalInstructions(projectDir)` → `string \| null`, reads from `INSTRUCTIONS_DIR/AGENTS.md` |
| `src/adapters/base.ts` | Simplified renderInstructions with single param | ✓ VERIFIED | Interface + implementation both single-param identity passthrough |
| `src/adapters/path-resolver.ts` | Corrected output filenames for all 4 targets | ✓ VERIFIED | CLAUDE.md for claude-code, AGENTS.md for opencode/gemini/codex |
| `src/adapters/__tests__/instructions.test.ts` | Tests for single-param renderInstructions | ✓ VERIFIED | 2 tests per adapter: identity passthrough + tilde preservation |
| `src/cli/__tests__/render.test.ts` | Tests for single-file readCanonicalInstructions | ✓ VERIFIED | `readCanonicalInstructions(projectDir)` call with no target param |
| `src/cli/__tests__/orchestrator.test.ts` | Integration tests with unified instructions setup | ✓ VERIFIED | `setupProject` writes single `configs/instructions/AGENTS.md` with unified content |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/cli/canonical.ts` | `configs/instructions/AGENTS.md` | readCanonicalInstructions reads single file | ✓ WIRED | L159: `join(projectDir, INSTRUCTIONS_DIR, 'AGENTS.md')` |
| `src/cli/check.ts` | `src/adapters/base.ts` | `adapter.renderInstructions(content)` | ✓ WIRED | L226: single-param call confirmed |
| `src/cli/push.ts` | `src/adapters/base.ts` | `adapter.renderInstructions(instructionContent)` | ✓ WIRED | L137: single-param call confirmed |
| `src/cli/render.ts` | `src/adapters/base.ts` | `adapter.renderInstructions(instructionContent)` | ✓ WIRED | L95: single-param call confirmed |
| `src/cli/diff.ts` | `src/adapters/base.ts` | `adapter.renderInstructions(instructionContent)` | ✓ WIRED | L107: single-param call confirmed |
| `src/adapters/path-resolver.ts` | target filesystem | `getInstructionsPath` returns per-target filename | ✓ WIRED | L97-104: CLAUDE.md / AGENTS.md ×3 |
| `src/adapters/__tests__/instructions.test.ts` | `src/adapters/base.ts` | `adapter.renderInstructions(content)` | ✓ WIRED | Single-param identity passthrough tests |
| `src/cli/__tests__/orchestrator.test.ts` | `src/cli/canonical.ts` | setupProject creates configs/instructions/AGENTS.md | ✓ WIRED | L33: writes unified AGENTS.md with CLI-Specific Notes |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INST-01 | 07-01, 07-02 | AGENTS.md lives at `configs/instructions/AGENTS.md` | ✓ SATISFIED | File exists at that path, 375 lines |
| INST-02 | 07-01, 07-02 | No AGENTS.md at repo root | ✓ SATISFIED | Repo-root AGENTS.md confirmed deleted |
| INST-03 | 07-01, 07-02 | AGENTS.md contains `## CLI-Specific Notes` with merged content | ✓ SATISFIED | Section at L280 with 4 CLI subsections |
| INST-04 | 07-01, 07-02 | Per-CLI addendum files deleted | ✓ SATISFIED | claude.md, opencode.md, gemini.md, codex.md all NOT_FOUND |
| INST-05 | 07-01 | `renderInstructions()` accepts single content parameter | ✓ SATISFIED | `base.ts:40` — `renderInstructions(content: string): string` |
| INST-06 | 07-01 | `readCanonicalInstructions()` reads single file | ✓ SATISFIED | `canonical.ts:156-165` — reads from `INSTRUCTIONS_DIR/AGENTS.md` |
| INST-07 | 07-01 | OpenCode output file is `AGENTS.md` | ✓ SATISFIED | `path-resolver.ts:100` — `'~/.config/opencode/AGENTS.md'` |
| INST-08 | 07-01 | Gemini output file is `AGENTS.md` | ✓ SATISFIED | `path-resolver.ts:101` — `'~/.gemini/AGENTS.md'` |
| INST-09 | 07-01 | Codex output file is `AGENTS.md` | ✓ SATISFIED | `path-resolver.ts:102` — `'~/.codex/AGENTS.md'` |
| INST-10 | 07-01 | Claude output file remains `CLAUDE.md` | ✓ SATISFIED | `path-resolver.ts:99` — `'~/.claude/CLAUDE.md'` |

**All 10 requirements satisfied. No orphaned requirements.**

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | None found |

No TODOs, FIXMEs, placeholders, or stub implementations detected in any modified file.

### Human Verification Required

### 1. Push produces correct output filenames on disk

**Test:** Run `acsync push --force --type instructions` and verify `~/.config/opencode/AGENTS.md`, `~/.gemini/AGENTS.md`, `~/.codex/AGENTS.md` are created (and old `OPENCODE.md`/`GEMINI.md`/`instructions.md` are stale)
**Expected:** New AGENTS.md files created at correct paths; content matches configs/instructions/AGENTS.md
**Why human:** Requires write to actual home directory targets

### 2. Stale file cleanup

**Test:** Run `acsync check --type instructions --pretty` and verify it shows drift for new filenames
**Expected:** Drift detected showing create operations for AGENTS.md at opencode/gemini/codex targets
**Why human:** Depends on current state of target filesystem

### Gaps Summary

No gaps found. All 7 observable truths verified, all 10 requirements satisfied, all artifacts substantive and wired, all 4 commits valid, full test suite passes (402/402). Phase goal achieved.

---

_Verified: 2026-02-24T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
