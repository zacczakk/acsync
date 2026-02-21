---
status: complete
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
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "All zz-* commands and agents removed from canonical source"
  status: failed
  reason: "User reported: zz-* prefixed commands and agents should be deleted from configs/common/commands/ and configs/common/agents/"
  severity: major
  test: 5
  root_cause: "Canonical still contains zz-*.md files that are no longer wanted"
  artifacts:
    - path: "configs/common/commands/"
      issue: "Contains zz-*.md files to be removed"
    - path: "configs/common/agents/"
      issue: "Contains zz-*.md files to be removed"
  missing:
    - "Trash all zz-*.md from configs/common/commands/ and configs/common/agents/"
  debug_session: ""

- truth: "push --delete removes stale target files that have no canonical source"
  status: failed
  reason: "User reported: stale files (zz-obs-*, old zz-* files) are not cleaned up after push. Want push to delete stale files only when --delete flag is set, and print stale files discovered even without --delete."
  severity: major
  test: 5
  root_cause: "EXCL-02 safe mode: diff engine has no delete operation type; push never removes files"
  artifacts:
    - path: "src/core/diff.ts"
      issue: "OperationType has no 'delete'; compareHashes never produces delete"
    - path: "src/cli/orchestrator.ts"
      issue: "Push loop has no delete execution path"
    - path: "src/cli/push.ts"
      issue: "No --delete flag"
  missing:
    - "Add 'delete' to OperationType"
    - "compareHashes/calculateDiff: detect stale items (on-disk but not in canonical)"
    - "Push: always surface stale items in output; only execute deletes when --delete flag set"
    - "Add --delete flag to push subcommand"
  debug_session: ""

- truth: "Skills are pushed to all CLIs that support them (gemini, codex if applicable)"
  status: failed
  reason: "User reported: skills don't seem to be pushed to gemini or codex"
  severity: major
  test: 9
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "check shows no MCP drift for Claude/Gemini after push (no perpetual drift)"
  status: failed
  reason: "User reported: perpetual drift is unacceptable; should use env vars instead of secret injection so rendered output matches on-disk content"
  severity: minor
  test: 10
  root_cause: "Secret injector replaces ${VAR} placeholders with real values at push time; check re-renders with placeholders, so hashes never match after injection"
  artifacts:
    - path: "src/infra/secrets.ts"
      issue: "injectSecrets replaces placeholders with real values before writing"
    - path: "src/cli/orchestrator.ts"
      issue: "Push path calls injectSecrets; check path does not — asymmetric"
  missing:
    - "Write ${VAR} placeholders as-is (no injection); rely on target CLI's native env var resolution"
    - "Remove injectSecrets call from push orchestration path"
    - "Verify Claude/Gemini/OpenCode/Codex all support native env var syntax in MCP config"
  debug_session: ""

- truth: "Claude commands dir is ~/.claude/commands/ (no zz/ subdir); names written as-is"
  status: failed
  reason: "User reported: obs-* commands land in zz/ subdir. Claude adapter should write directly to ~/.claude/commands/ with no prefix stripping."
  severity: major
  test: 5
  root_cause: "path-resolver rawCommandsDir() returns ~/.claude/commands/zz/; commandFileName strips zz- prefix; ClaudeCodeAdapter.commandNameFromFile adds zz- prefix"
  artifacts:
    - path: "src/adapters/path-resolver.ts"
      issue: "rawCommandsDir() and commandFileName() have zz- logic"
    - path: "src/adapters/claude-code.ts"
      issue: "commandNameFromFile() overrides base with zz- prefix"
  missing:
    - "path-resolver: claude-code rawCommandsDir → ~/.claude/commands/"
    - "path-resolver: remove zz- strip from commandFileName"
    - "ClaudeCodeAdapter: remove commandNameFromFile override"
  debug_session: ""
