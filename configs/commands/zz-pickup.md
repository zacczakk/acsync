---
description: Restore context from previous session and propose next action.
allowed-tools: [Read, Glob, Grep, Bash]
---

READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING (skip if missing).

# Pickup

You are resuming work from a previous session. Restore context and propose
the single best next action.

## Process

### Step 1 — Read state sources (in priority order)

Try each; use the first that exists:
1. `docs/plans/STATE.md` → read active task slug → read `docs/plans/{slug}/PLAN.md`
2. `.continue-here.md` at repo root
3. `PLAN.md` at repo root (legacy)
4. `PLAN.md` at repo root (legacy, lowercase variant)

If none exist, say so and skip to git state.

### Step 2 — Read git state

Run in parallel:
- `git status` — uncommitted work, branch name
- `git log -10 --oneline` — recent history
- `git stash list` — any stashed work

Note anything surprising (uncommitted changes, detached HEAD, etc).

### Step 3 — Check CI/PR state

Run (ignore errors if not in a PR context):
- `gh pr view --json state,title,reviews,statusCheckRollup 2>/dev/null`
- `gh run list -L3 2>/dev/null`

Flag: CI red, PR awaiting review, PR approved but not merged.

### Step 4 — Check for unresolved PR comments

- `gh pr view --comments 2>/dev/null`
- Look for unresolved review threads or requested changes.

### Step 5 — Present current state

Summarize in 3 sections:
- **Done**: what's been completed
- **In Progress**: what's partially done
- **Blocked**: what can't proceed and why

### Step 6 — Propose next action

Pick ONE concrete next step with reasoning:
- CI red → suggest investigating failures
- PR has unresolved comments → address them
- Task in progress → continue from where it left off
- Nothing active → ask what to work on

Format:
```
Recommended: [action]
Reason: [why this is the highest-priority move]
Verify: [how to confirm it's done]
```

Wait for confirmation before executing.
