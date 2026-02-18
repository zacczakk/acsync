---
description: Capture a decision to the central .tasks/DECISIONS.md log.
argument-hint: <decision>
allowed-tools: [Read, Write, Bash]
---

# /zz-decide — Log a Decision

READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING ELSE. Follow all rules there. Skip if file missing.

## Purpose

Quick decision capture during work. Not an interview — just logs a decision
with context and timestamp to `.tasks/DECISIONS.md`.

## Arguments

`$ARGUMENTS` = the decision text. Required.

Examples:
- `/zz-decide Use Zod instead of Yup for schema validation`
- `/zz-decide Keep the monorepo structure, don't split into separate repos`
- `/zz-decide Pin Node to 22.x LTS for CI stability`

If no arguments provided, prompt:
> "What's the decision? Usage: `/zz-decide <decision text>`"

## Procedure

### Step 1: Ensure .tasks/ directory exists

```bash
mkdir -p .tasks
```

### Step 2: Read existing decisions log

Read `.tasks/DECISIONS.md` if it exists. If not, it will be created.

### Step 3: Determine context tag

Check `.tasks/STATE.md` for an active task slug:
- If found: use the task slug as context (e.g., `auth-refactor`)
- If not found: use `general`

### Step 4: Append decision entry

Append to `.tasks/DECISIONS.md`:

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
> Decision logged to `.tasks/DECISIONS.md`
