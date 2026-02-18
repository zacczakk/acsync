---
description: Create structured session handoff with context for next pickup.
allowed-tools: [Read, Glob, Grep, Bash]
---

READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING (skip if missing).

# Handoff

You are producing a structured session close. Capture what changed, decisions made,
open questions, blockers, and next steps so the next session can resume without loss.

## Process

### Step 1 — Auto-gather context

Run these in parallel:
- `git diff --stat` — what files changed
- `git log -5 --oneline` — recent commits
- Check `.tasks/STATE.md` for active task slug
- If active task exists, read `.tasks/{slug}/TASK.md`

### Step 2 — Summarize changes

For each modified file or commit, note WHAT changed and WHY.
Group by feature/area, not by file. Skip noise (formatting, lockfiles).

### Step 3 — Capture decisions

List any design or implementation decisions made during this session.
Include the reasoning, not just the outcome.
Example: "Chose SQLite over Postgres — single-user CLI, no daemon dependency."

### Step 4 — Identify open questions and blockers

Anything unresolved that the next session needs to address.
Be specific: "Need to decide whether auth tokens expire" not "auth TBD".

### Step 5 — Write continuation file

**If `.tasks/` directory exists and there's an active task:**
- Update `.tasks/{active-slug}/TASK.md` — append a `## Session Notes` section
  (or update existing one) with date and summary.

**If no `.tasks/` directory:**
- Write `.continue-here.md` at repo root with the full handoff.

### Step 6 — Propose next steps

List 2–5 concrete next actions with verification criteria.
Example:
- "Implement rate limiter middleware → verify: `npm test` passes, new test covers 429 response"

## Output format

```markdown
## Changes
- [grouped summary of what changed and why]

## Decisions
- [decision]: [reasoning]

## Open Questions
- [specific unresolved items]

## Blockers
- [anything preventing progress]

## Next Steps
1. [action] → verify: [criteria]
2. [action] → verify: [criteria]
```

Keep it short. Actionable > thorough.
