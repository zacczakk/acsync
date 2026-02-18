---
description: Run verification — scoped or full gate. Spawns zz-verifier agent.
argument-hint: [scope]
allowed-tools: [Read, Glob, Grep, Bash]
---

READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING (skip if missing).

# Verify

Run verification checks. Either scoped to a specific area or full gate.

## Scope detection

- **$ARGUMENTS provided** → scope verification to that area (test file, module, check type).
- **No args** → run full gate: all discoverable checks.

## Discovery

Detect available checks by looking for:
- `package.json` scripts: `test`, `lint`, `typecheck`, `build`
- `Makefile` / `justfile` targets
- `.tasks/{active}/TASK.md` verification criteria
- AGENTS.md "Build / Test" section for repo-specific gates
- CI config (`.github/workflows/`) for the canonical check list

Prioritize the TASK.md criteria if they exist — those are the acceptance tests
for the current work.

## Spawn zz-verifier agent

Pass to the zz-verifier:
- Discovered check commands
- Scope constraints (if any)
- TASK.md verification criteria (if any)
- Instruction: run each check, capture output, report pass/fail

## Present results

Format:
```
Check            Status   Notes
─────            ──────   ─────
typecheck        PASS
lint             PASS
tests            FAIL     2 failures in auth.test.ts
build            PASS
task criteria    PARTIAL  3/5 criteria met
```

For failures: show relevant error output and suggest fixes.
If all pass: confirm clean and note any checks that were skipped.
