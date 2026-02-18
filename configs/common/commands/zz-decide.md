---
description: Capture a decision to the central docs/plans/DECISIONS.md log.
argument-hint: <decision>
allowed-tools: [Read, Write, Bash]
---

# /zz-decide — Log a Decision

READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING ELSE. Follow all rules there. Skip if file missing.

## Purpose

Quick decision capture during work. Not an interview — just logs a decision
with context and timestamp to `docs/plans/DECISIONS.md`.

## Arguments

`$ARGUMENTS` = the decision text. Required.

Examples:
- `/zz-decide Use Zod instead of Yup for schema validation`
- `/zz-decide Keep the monorepo structure, don't split into separate repos`
- `/zz-decide Pin Node to 22.x LTS for CI stability`

If no arguments provided, prompt:
> "What's the decision? Usage: `/zz-decide <decision text>`"

## Procedure

### Step 1: Ensure docs/plans/ directory exists

```bash
mkdir -p .tasks
```

### Step 2: Read existing decisions log

Read `docs/plans/DECISIONS.md` if it exists. If not, it will be created.

### Step 3: Determine context tag

Check `docs/plans/STATE.md` for an active task slug:
- If found: use the task slug as context (e.g., `auth-refactor`)
- If not found: use `general`

### Step 4: Append decision entry

Append to `docs/plans/DECISIONS.md`:

```markdown
### YYYY-MM-DD — [First ~60 chars of decision text]
**Context:** [task slug or "general"]
**Decision:** [Full $ARGUMENTS text]
```

If the file doesn't exist yet, create it with a header first:

```markdown
# Decisions

### YYYY-MM-DD — [First ~60 chars]
**Context:** [context]
**Decision:** [full text]
```

### Step 5: Confirm

Output:
> Decision logged to `docs/plans/DECISIONS.md`
