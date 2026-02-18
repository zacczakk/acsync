---
description: Test-guarded refactoring with behavioral equivalence. Spawns zz-refactorer agent.
argument-hint: [scope]
allowed-tools: [Read, Glob, Grep, Edit, Write, Bash]
---

READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING (skip if missing).

# Refactor

Test-guarded refactoring. Behavioral equivalence is the hard constraint —
nothing should change except clarity, structure, and maintainability.

## Scope detection

- **$ARGUMENTS provided** → scope to specified files or directories.
- **No args** → use recently modified files: `git diff --name-only HEAD~3`

If scope is empty (no recent changes, no args), ask the user what to refactor.

## Pre-flight: test coverage check

Before touching anything, verify tests exist for the target scope:
- Run the test suite scoped to affected files if possible
- If no tests cover the scope, WARN the user:
  "No test coverage found for [scope]. Refactoring without tests risks silent breakage.
   Options: (1) write tests first, (2) proceed with manual verification, (3) abort."
- Wait for user decision if no coverage.

If tests exist, run them and confirm they pass BEFORE any edits.

## Spawn zz-refactorer agent

Pass to the zz-refactorer:
- Files in scope (full content)
- Test results (baseline — must still pass after)
- Repo conventions from AGENTS.md
- Instruction: preserve behavior exactly; no functional changes
- Instruction: prefer explicit readable code over cleverness
- Instruction: follow repo patterns; don't introduce new paradigms

## Present results

- Summary of what changed and why (grouped by theme, not by file)
- Diff stat
- Test results after refactoring (must match baseline)
- If tests fail after refactoring: revert and report what went wrong
