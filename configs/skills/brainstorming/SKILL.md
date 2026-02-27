---
name: brainstorming
description: >
  Structured requirements exploration before implementation. Use before creating
  features, building components, adding functionality, or modifying behavior.
  Explores intent, requirements, and design before any code is written.
---

# Brainstorming Ideas Into Designs

Turn ideas into designs through collaborative dialogue. Understand context, ask questions, present design, get approval — then implement.

**Hard gate:** No code, no scaffolding, no implementation until design is presented and approved. Applies to every project regardless of perceived simplicity.

## Process

1. **Explore context** — check files, docs, recent commits
2. **Ask clarifying questions** — one at a time; prefer multiple choice; focus on purpose, constraints, success criteria
3. **Propose 2-3 approaches** — with trade-offs; lead with recommendation and reasoning
4. **Present design** — scale each section to complexity (few sentences if simple, detailed if nuanced); get approval after each section
5. **Save design** — write to `docs/plans/` and commit
6. **Transition** — hand off to implementation (plan or direct execution)

## Design Sections

Cover as needed, scaled to complexity:
- Architecture / component structure
- Data flow
- Error handling
- Testing strategy
- Open questions

## Principles

- **One question at a time** — don't overwhelm
- **YAGNI ruthlessly** — cut unnecessary features from all designs
- **Explore alternatives** — always 2-3 approaches before settling
- **Incremental validation** — present, approve, move on
- **"Too simple to design" is a trap** — unexamined assumptions cause the most wasted work; design can be short but must exist

## Anti-Pattern

Skipping brainstorming because the task "seems obvious." Simple projects are where unexamined assumptions cause the most rework. A design for a simple task can be 3 sentences — but present it and get approval.
