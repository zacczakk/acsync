---
name: agent-brief
description: Use when preparing work for another agent, converting clarified requirements into a durable implementation brief, or making an issue ready for autonomous execution.
---

# Agent Brief

## Overview

An agent brief is the contract an AFK agent works from. It should survive stale file paths and changed line numbers by describing behavior, interfaces, acceptance criteria, and scope boundaries.

## When to Use

- After `grill-with-docs` resolves a feature, bug, or design.
- When making a GitHub issue, Outcome Engine item, or plan ready for agent execution.
- When handing off work that may sit for days before implementation.

Do not use for immediate one-off tasks where the same agent will implement from live context.

## Brief Template

```md
## Agent Brief

**Category:** bug | enhancement | chore | research
**Summary:** One-line outcome.

**Current behavior:**
What happens now. For enhancements, describe the status quo.

**Desired behavior:**
What should be true after the work. Include edge cases and error behavior.

**Key interfaces:**
- `TypeName` or concept — what contract needs to change and why
- `command` or config shape — expected behavior and constraints

**Acceptance criteria:**
- [ ] Specific, testable criterion
- [ ] Specific, testable criterion

**Out of scope:**
- Adjacent feature or tempting cleanup that should not be included
```

## Rules

- Describe what the system should do, not implementation steps.
- Prefer interfaces, types, commands, and behavioral contracts over file paths.
- Avoid line numbers. They rot immediately.
- Acceptance criteria must be independently verifiable.
- Include explicit out-of-scope bullets to block gold-plating.
- If a user decision explains the brief, reference the decision artifact instead of copying full history.

## Good vs Bad

Good:
- "The `SkillConfig` shape should accept an optional `schedule` field using cron syntax. Existing configs without `schedule` remain valid."
- "Running `metronome push --type skill` writes the new skill to all configured agent targets without drift on a second run."

Bad:
- "Open `src/types.ts` and add a field around line 42."
- "Fix the skill sync bug."
- "Make it work like we discussed."

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| File-by-file instructions | State behavioral contract and key interfaces. |
| Vague acceptance | Make every criterion runnable, observable, or inspectable. |
| No scope boundary | Add out-of-scope bullets. |
| Copying full conversation | Distill decisions; link artifacts when available. |
