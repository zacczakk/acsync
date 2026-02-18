---
description: Write tests for specified scope. Spawns zz-test-writer agent.
argument-hint: [scope]
allowed-tools: [Read, Glob, Grep, Edit, Write, Bash]
---

# /zz-test — Write Tests

READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING ELSE. Follow all rules there. Skip if file missing.

## Purpose

Write tests for a specified scope (file, function, or directory).
Spawns a zz-test-writer subagent to do the work.

## Arguments

`$ARGUMENTS` = scope to test. Required.

Examples:
- `/zz-test src/parser.ts` — write tests for the parser module
- `/zz-test handleAuth` — write tests for the handleAuth function
- `/zz-test src/utils/` — write tests for all utils

If no arguments provided, prompt the user:
> "What should I write tests for? Provide a file, function name, or directory."

## Procedure

### 1. Resolve scope

- If scope is a file path: verify it exists
- If scope is a function name: search codebase to locate it
- If scope is a directory: enumerate testable files within it

### 2. Spawn zz-test-writer agent

Spawn a subagent (see docs/subagent.md) with:
- The resolved scope (files/functions to test)
- Existing test patterns in the repo (test framework, naming conventions, file locations)
- Instruction to follow AGENTS.md rules (no mocks unless absolutely necessary, prefer unit/e2e)

The zz-test-writer agent should:
- Read the source code to understand behavior
- Identify edge cases, error paths, and boundary conditions
- Write tests following existing repo conventions
- Run the tests to verify they pass

### 3. Present results

After the agent completes, report:

```
Tests written:
  tests/parser.test.ts  — 8 tests (all passing)
  tests/lexer.test.ts   — 5 tests (all passing)

Coverage: 13 new test cases covering:
  - Happy path parsing
  - Malformed input handling
  - Edge cases (empty input, max size)
  - Error propagation
```

If any tests fail, show the failures and fix them before reporting done.
