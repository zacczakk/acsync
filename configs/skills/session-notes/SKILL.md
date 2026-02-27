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
- A task or topic is completed
- Compaction is imminent (capture context before it compresses)

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
---

# Checkpoint: <current task/topic>

## Current State
Where things stand right now.

## Open Threads
- Unresolved questions, next steps, blockers.

## Key Context
Details that would be lost in compaction.
```

## Rules

- One note per trigger. Keep each note under 40 lines.
- Use filesystem write — backticks in content break shell.
- Frontmatter `projects`: repo name or project slug from MEMORY.md.
- If a discovery is reusable across projects, also create/update a note in `~/Vaults/Memory/patterns/`.
- Checkpoints can reference files by path for traceability.
