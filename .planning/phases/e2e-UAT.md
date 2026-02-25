---
status: complete
phase: e2e-full-cli
source: [06-01-SUMMARY.md, 06-02-SUMMARY.md, 07-01-SUMMARY.md, 07-02-SUMMARY.md, 08-01-SUMMARY.md, 08-02-SUMMARY.md]
started: 2026-02-24T20:00:00Z
updated: 2026-02-24T20:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Binary available from PATH
expected: `acsync --version` prints version; `acsync --help` lists check/push/pull/render/diff subcommands
result: pass

### 2. Check detects current state (no drift)
expected: `acsync check --pretty` from repo dir shows all 52 items with green checkmarks, exits 0
result: pass

### 3. Check works from non-repo directory
expected: Running `acsync check --pretty` from `~` produces identical output — PROJECT_ROOT resolves from binary location
result: pass

### 4. Check JSON output (agent-friendly)
expected: `acsync check` outputs structured JSON with targets object containing operation arrays with type/itemType/name/target/reason fields
result: pass

### 5. Push dry-run
expected: `acsync push --dry-run --pretty` shows current state without writing. All items show up-to-date (no drift exists).
result: pass

### 6. Push with force
expected: `acsync push --force --pretty` writes all configs. After push, `acsync check` reports zero drift.
result: skipped
reason: All 52 items already up-to-date; push would be no-op. Verified via check instead.

### 7. Target filtering
expected: `acsync check --target claude --pretty` shows only Claude's 13 items. No other targets shown.
result: pass

### 8. Type filtering
expected: `acsync check --type commands --pretty` shows only command items (32 across 4 targets). No MCP/instruction/skill items shown.
result: pass

### 9. Render single item
expected: `acsync render --type command --name obs-jot --target opencode` outputs rendered OpenCode frontmatter format to stdout
result: pass

### 10. Instruction output filenames correct
expected: `~/.claude/CLAUDE.md`, `~/.config/opencode/AGENTS.md`, `~/.gemini/AGENTS.md`, `~/.codex/AGENTS.md` all exist
result: pass

### 11. No stale instruction files
expected: `~/.config/opencode/OPENCODE.md`, `~/.gemini/GEMINI.md`, `~/.codex/instructions.md` do not exist
result: pass

### 12. Canonical structure is flat
expected: `configs/` contains agents/, commands/, instructions/, mcp/, settings/, skills/ directly — no common/ subdirectory
result: pass

### 13. TOOLS.md exists and is referenced
expected: `configs/instructions/TOOLS.md` exists; AGENTS.md references it in ## Tools section
result: pass

### 14. No stale path references
expected: Zero grep hits for `~/Repos/acsync` (without trailing `s` from acsync) in configs/ and src/
result: pass

### 15. Tests pass
expected: `bun test` runs full suite with 0 failures
result: pass

## Summary

total: 15
passed: 14
issues: 0
pending: 0
skipped: 1

## Gaps

[none]
