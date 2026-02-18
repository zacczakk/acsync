---
description: Goal-backward task planning — reads CONTEXT.md, writes TASK.md with test-first criteria.
argument-hint: [goal]
allowed-tools: [Read, Glob, Grep, Edit, Write, Bash]
---

READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING (skip if missing).

# Plan

Goal-backward planning. Start from the desired outcome, work backward to steps,
write a TASK.md with test-first verification criteria.

## Process

### Step 1 — Determine goal

- **$ARGUMENTS provided** → use as the goal.
- **No args, active task exists** (`.tasks/*/TASK.md`) → update existing plan.
- **No args, no task** → ask the user what the goal is. Do not guess.

### Step 2 — Auto-detect CONTEXT.md

Search `.tasks/*/CONTEXT.md` for planning context from /zz-discuss sessions.

- **One found** → notify user: "Using context from .tasks/{slug}/CONTEXT.md"
- **Multiple found** → use most recently modified; notify user which one.
- **None found** → notify user: "No CONTEXT.md found — consider running /zz-discuss first
  for richer planning input." Continue with goal alone.

Read the selected CONTEXT.md fully — it contains scope, decisions, specific ideas,
and deferred items that should inform the plan.

### Step 3 — Load accumulated decisions

If `.tasks/DECISIONS.md` exists, read it. These are cross-task decisions that
should be respected unless the user explicitly overrides them.

### Step 4 — Generate task slug

Create a kebab-case slug from the goal. Examples:
- "Add user authentication" → `add-user-auth`
- "Refactor database layer" → `refactor-db-layer`

If updating an existing task, reuse its slug.

### Step 5 — Create task directory

```
mkdir -p .tasks/{slug}/
```

### Step 6 — Spawn zz-planner agent

Pass to the zz-planner:
- The goal
- CONTEXT.md content (if any)
- DECISIONS.md content (if any)
- Repo conventions from AGENTS.md
- Current codebase structure (`find . -type f -name '*.ts' -o -name '*.py' | head -50` or similar)

The zz-planner should produce a TASK.md with:

```markdown
# {Goal}

## Status
[ ] Not started

## Outcome
[What "done" looks like — observable, testable]

## Steps
1. [Step] → verify: [how to confirm]
2. [Step] → verify: [how to confirm]
...

## Test-first criteria
- [Test that must pass before shipping]
- [Test that must pass before shipping]

## Deferred
- [Out of scope items from CONTEXT.md]

## Open questions
- [Anything still unresolved]
```

### Step 7 — Update STATE.md

Write or update `.tasks/STATE.md`:
```markdown
active: {slug}
updated: {ISO date}
```

## Output

- Print path to created/updated TASK.md
- Print a 3–5 line summary of the plan
- If CONTEXT.md was used, note which decisions carried forward
- Offer: "Run /zz-verify after implementation to check all criteria."
