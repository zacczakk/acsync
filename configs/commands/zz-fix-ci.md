---
description: Diagnose and fix CI failures iteratively until green.
allowed-tools: [Read, Glob, Grep, Edit, Write, Bash]
---

# /zz-fix-ci — Diagnose and Fix CI Failures

READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING ELSE. Follow all rules there. Skip if file missing.

## Purpose

Read CI logs, diagnose the failure, fix it, push, and repeat until CI is green.
Capped at **3 iterations** — if still failing after 3, surface to user.

This runs in **main context** (NOT a subagent) because it's an iterative loop
that requires pushing commits between iterations.

## Constraints

- NEVER force push. NEVER `--no-verify`. NEVER skip tests.
- Each fix gets its own commit with a conventional commit message (`fix: ...`).
- Always verify locally before pushing.
- Do not refactor unrelated code — fix only what CI is complaining about.

## Procedure

Repeat up to 3 times:

### Step 1: Read CI failure logs

```bash
gh run list -L5 --json status,conclusion,name,databaseId
```

Find the most recent failed run. Then:

```bash
gh run view {id} --log-failed
```

If the log is too large, focus on the failing job/step.

### Step 2: Diagnose failure category

Classify the failure:
- **Lint error** — formatting, unused vars, import order
- **Type error** — TypeScript/mypy/cargo type mismatch
- **Test failure** — assertion failed, timeout, missing fixture
- **Build failure** — compilation error, missing dependency
- **Env/config issue** — missing secret, wrong Node version, CI config error

If it's an env/config issue that can't be fixed in code, stop and tell the user.

### Step 3: Fix the issue

Apply the minimal edit to fix the failure. Read the relevant source files first.
Understand the root cause — don't just silence the error.

### Step 4: Verify locally

Run the gate locally before pushing:

1. Lint (if lint failure)
2. Type check (if type failure)
3. Tests (if test failure)
4. Build (if build failure)

Only proceed to push if the local check passes.

### Step 5: Commit and push

```bash
git add <changed-files>
git commit -m "fix: <describe what was fixed>"
git push
```

### Step 6: Check CI result

Wait briefly, then check:

```bash
gh run list -L1 --json status,conclusion,databaseId
```

If the run is still in progress, poll with `gh run watch {id}` or check back.

- **CI passes** → Done. Report success with summary of all fixes applied.
- **CI fails** → Go back to Step 1.

## After 3 iterations

If CI is still red after 3 fix attempts, stop and present a diagnostic summary:

```
CI still failing after 3 iterations.

Iteration 1: Fixed lint error in src/foo.ts (unused import)
Iteration 2: Fixed type error in src/bar.ts (wrong return type)
Iteration 3: Fixed test assertion in tests/baz.test.ts (stale snapshot)

Current failure: [describe what's still failing]

Recommend: [manual investigation / environment issue / flaky test / etc.]
```
