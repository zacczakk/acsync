---
status: diagnosed
phase: 03-diff-engine-cli
source: 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md
started: 2026-02-21T00:00:00Z
updated: 2026-02-21T00:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. check detects drift
expected: Run `bun src/cli/index.ts check`. Output is JSON listing drifted items. Exit code 2 when drift exists, 0 when synced.
result: pass

### 2. check --pretty output
expected: Run `bun src/cli/index.ts check --pretty`. Output is human-readable colored text (✓/⚠ style), not JSON.
result: pass

### 3. check --target scoping
expected: Run `bun src/cli/index.ts check --target claude`. Only Claude drift is reported; other targets ignored.
result: pass

### 4. push --dry-run shows plan without writing
expected: Run `bun src/cli/index.ts push --dry-run`. Shows what would be written but no files are changed on disk.
result: pass

### 5. push writes files and clears drift
expected: Run `bun src/cli/index.ts push --force`. Files written to target locations. Subsequent `check` shows 0 drift for written targets.
result: issue
reported: "After push, check still shows drift: MCP modified (tavily, context7) and stale commands (zz-obs-*). Push creates wrong files -- obs-* commands land in zz/ subdir instead of commands/ directly. Also, stale files are not cleaned up."
severity: major

### 6. push rollback on failure
expected: If push encounters an error mid-run, previously written files in that run are restored to their pre-push state (rollback behavior).
result: skipped
reason: No easy way to trigger mid-run failure without fault injection; covered by unit tests

### 7. MCP rendering -- OpenCode disabled server
expected: After push, OpenCode MCP config contains sequential-thinking with `"enabled": false`. Other CLIs (Claude/Gemini/Codex) do not include sequential-thinking at all.
result: skipped
reason: Blocked by zz/ subdir bug — can't do a clean push to verify MCP output

### 8. Tavily rendered for all CLIs
expected: After push, all four CLIs (Claude, Gemini, OpenCode, Codex) have Tavily in their MCP config (except Codex which only renders HTTP transports).
result: pass

### 9. Manifest stored at .acsync/manifest.json
expected: After a push, `.acsync/manifest.json` exists in the project root and contains hash entries for pushed items.
result: pass

### 10. Secret injection drift known limitation
expected: Running `check` after push shows drift for Claude/Gemini MCP entries. This is expected: injected secrets differ from rendered placeholders.
result: issue
reported: "pass, but this needs to be handled differently. e.g. use env vars instead of secret injection?"
severity: minor

## Summary

total: 10
passed: 6
issues: 2
pending: 0
skipped: 2

## Gaps

- truth: "obs-* commands written to ~/.claude/commands/ directly (no zz/ subdir)"
  status: failed
  reason: "User reported: push creates zz-obs-* files in zz/ subdir instead of obs-* in commands/ directly"
  severity: major
  test: 5
  root_cause: "path-resolver rawCommandsDir() returns ~/.claude/commands/zz/ for claude-code; commandFileName() strips zz- prefix; ClaudeCodeAdapter.commandNameFromFile() adds zz- prefix in reverse — all three need removal"
  artifacts:
    - path: "src/adapters/path-resolver.ts"
      issue: "rawCommandsDir() returns ~/.claude/commands/zz/; commandFileName() strips zz- prefix (lines 72, 122-124)"
    - path: "src/adapters/claude-code.ts"
      issue: "commandNameFromFile() override prepends zz- (lines 21-24)"
    - path: "src/adapters/__tests__/claude-code.test.ts"
      issue: "Tests assert zz/ path and stripped names — need updating"
    - path: "src/cli/__tests__/orchestrator.test.ts"
      issue: "Cleanup comment references ~/.claude/commands/zz/ (line 176)"
  missing:
    - "path-resolver: claude-code rawCommandsDir → ~/.claude/commands/"
    - "path-resolver: commandFileName claude-code case → ${name}.md (no prefix strip)"
    - "ClaudeCodeAdapter: remove commandNameFromFile() override entirely"
    - "Update affected tests"
  debug_session: ""

- truth: "All zz-* commands and agents removed from canonical source"
  status: failed
  reason: "User reported: zz-* prefixed commands and agents should be deleted from configs/common/commands/ and configs/common/agents/"
  severity: major
  test: 5
  root_cause: "Diagnosis found configs/common/commands/ already has no zz-* files and configs/common/agents/ is empty — canonical is already clean. Stale zz-* files on disk in target CLIs will be cleaned up once --delete is implemented."
  artifacts:
    - path: "configs/common/commands/"
      issue: "Already clean — only obs-*.md files present"
    - path: "configs/common/agents/"
      issue: "Already empty"
  missing:
    - "No canonical deletion needed — already clean"
    - "Stale zz-* files on target CLIs handled by --delete gap"
  debug_session: ""

- truth: "push --delete removes stale target files; stale always surfaced in output"
  status: failed
  reason: "User reported: stale files not cleaned up. Want push to delete stale files only when --delete flag is set; always print stale files discovered."
  severity: major
  test: 5
  root_cause: "detectStaleItems() and delete OperationType already exist in orchestrator. runPush already executes deleteOps — but unconditionally, with no --delete flag to gate it. Missing: flag + gate + always-surface-in-check behavior."
  artifacts:
    - path: "src/cli/push.ts"
      issue: "No --delete flag"
    - path: "src/cli/orchestrator.ts"
      issue: "runPush executes deleteOps unconditionally (line 583); SyncOptions has no deleteStale field"
    - path: "src/types.ts"
      issue: "SyncOptions missing deleteStale?: boolean"
  missing:
    - "push.ts: add --delete boolean flag (default false)"
    - "types.ts: add deleteStale?: boolean to SyncOptions"
    - "orchestrator.ts runPush: guard delete loop with if (options.deleteStale)"
    - "check output: always show stale items regardless of flag"
  debug_session: ""

- truth: "Skills are pushed to all CLIs that support them (gemini, codex if applicable)"
  status: failed
  reason: "User reported: skills don't seem to be pushed to gemini or codex"
  severity: major
  test: 9
  root_cause: "GeminiAdapter and CodexAdapter both declare skills: false in getCapabilities(); orchestrator gates skill push on caps.skills. BaseAdapter.renderSkill() already works; path-resolver default case already produces valid paths."
  artifacts:
    - path: "src/adapters/gemini.ts"
      issue: "getCapabilities() returns skills: false (line 18)"
    - path: "src/adapters/codex.ts"
      issue: "getCapabilities() returns skills: false (line 22)"
  missing:
    - "Verify ~/.gemini/skills/ and ~/.codex/skills/ are real paths those CLIs read"
    - "gemini.ts: set skills: true in getCapabilities() if path confirmed"
    - "codex.ts: set skills: true in getCapabilities() if path confirmed"
    - "Add skills assertions to gemini + codex adapter tests"
  debug_session: ""

- truth: "check shows no MCP drift for Claude/Gemini after push (no perpetual drift)"
  status: failed
  reason: "User reported: perpetual drift is unacceptable; should use env vars instead of secret injection so rendered output matches on-disk content"
  severity: minor
  test: 10
  root_cause: "injectSecrets() called only in runPush (not runCheck); manifest stores pre-inject hash; on-disk file has injected content; next check hashes injected content → mismatch forever. Note: Claude/Gemini have no native ${VAR} resolution in MCP config — design decision needed."
  artifacts:
    - path: "src/cli/orchestrator.ts"
      issue: "injectSecrets called at line 651 in push path only; loadSecrets at lines 536-537"
    - path: "src/secrets/injector.ts"
      issue: "injectSecrets does in-place substitution with no opt-out"
  missing:
    - "Decision: remove secret injection entirely and write placeholders as-is, OR call injectSecrets in check too (so hashes match but secrets still written to disk)"
    - "If removing injection: orchestrator.ts remove injectSecrets call + loadSecrets setup"
    - "Verify each CLI's native env var resolution capability before deciding"
  debug_session: ""
