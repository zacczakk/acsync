---
name: grill-with-docs
description: Use when a plan, design, requirement, or implementation approach needs stress-testing before code, especially when project language, hidden constraints, docs, or architectural decisions matter.
---

# Grill With Docs

## Overview

Shared understanding beats fast misunderstanding. Interview the user until the plan is crisp, but do not ask questions the repository can answer.

## When to Use

- User asks to be grilled, challenged, stress-tested, or aligned before implementation.
- Requirements are fuzzy, high-risk, or likely to encode hidden domain language.
- The change may create durable terminology, scope boundaries, or hard-to-reverse decisions.
- Before writing a PRD, plan, or agent brief when the current context is incomplete.

Do not use for trivial edits where the desired change is already concrete and reversible.

## Core Loop

1. Read repo guidance first: `AGENTS.md`, `README.md`, relevant `docs/`, existing `docs/context.md`, and `docs/adr/` if present.
2. Explore code when it can answer a question. Never ask the user to restate facts visible in code or docs.
3. Ask one question at a time. Each question should resolve a real branch of the design tree.
4. Include your recommended answer with each question.
5. When a term or decision crystallizes, capture it immediately if it will help future agents.
6. Continue until scope, language, constraints, acceptance criteria, and open risks are explicit.

## Context Doc

Use `docs/context.md` as the canonical shared-language file. Create it lazily only after the first useful term or ambiguity is resolved.

```md
# Context

## Language

**Canonical Term**: One-sentence definition.
_Avoid_: Ambiguous synonym, stale name

## Relationships

- **Term A** owns **Term B**.

## Flagged Ambiguities

- "account" used for both **Customer** and **User**; resolved as distinct concepts.
```

Rules:
- Add only domain/project concepts, not general programming terms.
- Pick one canonical term and list aliases to avoid.
- Keep definitions one sentence.
- Record relationships when they clarify boundaries.

## ADRs

Use `docs/adr/NNNN-short-title.md`. Create `docs/adr/` lazily.

Offer an ADR only when all are true:
- Hard to reverse.
- Surprising without context.
- Result of a real tradeoff.

ADR body can be tiny:

```md
# Short Decision Title

We chose X over Y because Z. This matters because future maintainers might otherwise assume A.
```

## Question Quality

Good questions are specific and actionable:
- "Should the import pipeline treat duplicate rows as idempotent updates or validation errors? Recommended: idempotent updates, because reruns should be safe."
- "Your docs define Customer as the billing owner, but this flow talks about end users. Are those distinct? Recommended: yes, use User for login identity."

Bad questions:
- "Can you provide more context?"
- "What should I know?"
- "How should this work?"

## Stop Condition

Stop when you can state:
- Problem and desired outcome.
- In-scope and out-of-scope work.
- Canonical terms and resolved ambiguities.
- Key constraints and tradeoffs.
- Acceptance criteria or next artifact to produce.

Then summarize and recommend the next skill or artifact: `agent-brief`, `writing-plans`, `oe-create-plan`, or implementation.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Asking before reading docs | Read first, then ask only unresolved questions. |
| Batching questions | One question at a time. |
| No recommendation | Include your recommended answer. |
| Capturing every thought | Capture only durable terms and hard decisions. |
| Creating ADRs for obvious choices | ADR only when hard to reverse, surprising, and tradeoff-driven. |
