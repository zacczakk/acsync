---
name: session-notes
description: >
  Write atomic notes to Memory vault capturing decisions, discoveries, patterns,
  and checkpoints. Triggers: meaningful decision, discovery/correction, task
  completion, pre-compaction. Use throughout sessions, not just at end.
---

# Session Notes

Atomic knowledge capture to `~/Vaults/Memory/sessions/`.

**Triggers** — write a note when:
- A meaningful decision is made (approach, tool, architecture, tradeoff)
- Something is learned or corrected (struggled lookup, wrong assumption, new fact)
- A dead end is hit (tried X, failed because Y, pivoted to Z)
- An external reference changed a decision (docs, API behavior, version constraint)
- Surprising tool/API behavior is observed
- A "I'll need this later" moment occurs
- A task or topic is completed
- Compaction is imminent (capture context before it compresses)

**Write at point-of-discovery, not end-of-task.** A redundant note costs less than a lost insight.

**Skip** trivial decisions (variable names, formatting, obvious refactors).

## Filename

`YYYY-MM-DD-<slug>.md` — slug = 2-5 word kebab-case describing the content. Multiple files per day expected.

## Note Types

### Decision

```md
---
type: decision
date: YYYY-MM-DD
projects: [project-name]
tags: [session, decision]
consolidated: false
---

# <What was decided>

## Context
Why this came up.

## Choice
What was chosen.

## Alternatives
- Alt (why rejected)

## Rationale
Why this wins.
```

### Discovery

```md
---
type: discovery
date: YYYY-MM-DD
projects: [project-name]
tags: [session, discovery]
consolidated: false
---

# <What was learned>

## Detail
What happened, what was wrong/missing.

## Implication
What to do differently next time.
```

### Checkpoint

Pre-compaction state capture. Write when context is about to compress.

```md
---
type: checkpoint
date: YYYY-MM-DD
projects: [project-name]
tags: [session, checkpoint]
consolidated: false
---

# Checkpoint: <current task/topic>

## Current State
Where things stand right now.

## Open Threads
- Unresolved questions, next steps, blockers.

## Key Context
Details that would be lost in compaction.
```

### Dead End

```md
---
type: dead-end
date: YYYY-MM-DD
projects: [project-name]
tags: [session, dead-end]
consolidated: false
---

# <What was tried>

## Approach
What was attempted and why it seemed viable.

## Failure
Why it didn't work.

## Pivot
What was done instead.
```

### Session Handoff

End-of-session state capture for cross-session continuity. Write when ending a long/complex session, or when the user says "let's pick this up later."

```md
---
type: checkpoint
date: YYYY-MM-DD
projects: [project-name]
tags: [session, handoff]
consolidated: false
---

# Handoff: <current work summary>

## What Was Done
Completed items, key changes made.

## What Worked
Approaches that succeeded, tools that helped.

## What Failed
Dead ends, rejected approaches, things to avoid.

## Next Steps
Concrete actions for the next session. Be specific — file paths, function names, remaining items.

## Open Questions
Unresolved decisions, things that need user input.

## Key Context
Details a fresh agent needs to continue (file locations, architectural decisions, constraints discovered).
```

**Pickup pattern:** Next session starts with: "Read `~/Vaults/Memory/sessions/YYYY-MM-DD-handoff-<slug>.md` and continue from there."

## Rules

- One note per trigger. Keep each note under 40 lines (handoffs can be longer — up to 60 lines).
- Use filesystem write — backticks in content break shell.
- Frontmatter `projects`: repo name or project slug from MEMORY.md.
- If a discovery is reusable across projects, also create/update a note in `~/Vaults/Memory/patterns/`.
- Checkpoints can reference files by path for traceability.
