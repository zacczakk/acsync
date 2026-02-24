---
description: Code review with auto-detected scope — spawns zz-reviewer agent.
argument-hint: [scope]
allowed-tools: [Read, Glob, Grep, Bash]
---

READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING (skip if missing).

# Review

Perform a code review. Auto-detect scope, then spawn a zz-reviewer agent for deep analysis.

## Scope detection (first match wins)

1. **$ARGUMENTS provided** → use as scope (files, directories, or PR number)
2. **On a PR branch** → `gh pr diff` to get changed files
3. **Staged + unstaged changes** → `git diff` + `git diff --cached`
4. **Last commit** → `git log -1 --name-only`

If nothing detected, tell the user and stop.

## Context gathering

- Collect the diff for the detected scope.
- If on a PR branch, also gather existing review comments:
  `gh pr view --comments 2>/dev/null`
  `gh api repos/{owner}/{repo}/pulls/{number}/reviews 2>/dev/null`
- Read AGENTS.md conventions for repo-specific review criteria.

## Spawn zz-reviewer agent

Pass to the zz-reviewer:
- The full diff
- Any existing PR review comments (so it doesn't repeat them)
- Repo conventions from AGENTS.md
- Instruction to rank findings by severity: 🔴 bug/security → 🟡 logic/perf → 🟢 style/nit

## Present findings

Show results grouped by severity. For each finding:
- File and line reference
- What's wrong and why it matters
- Suggested fix (code if possible)

If no issues found, say so explicitly and note any residual risks.
