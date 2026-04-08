---
name: design-critique
description: >-
  Review UI work for anti-slop tells, hierarchy, cognitive load, and UX quality.
  Use when the user asks to critique, review, evaluate, or improve an existing
  design.
---

Review the requested UI directly and produce a concise, actionable critique.

## Preparation

1. Read the relevant code and UI files.
2. Use project design context from loaded instructions or `.design-context.md` when available.
3. If context is missing, continue with explicit assumptions rather than blocking.

## Evaluate

Assess the UI across these areas:

1. **Anti-pattern verdict**: Does it look generic or AI-generated? Name the specific tells.
2. **Visual hierarchy**: Is the primary action and reading order obvious?
3. **Cognitive load**: Is the structure understandable, or does it overload the user?
4. **Tone and fit**: Does it feel right for the audience and product?
5. **Discoverability**: Are actions and paths obvious without explanation?
6. **Typography**: Does type support hierarchy, readability, and tone?
7. **States and edge cases**: Empty, loading, error, success, hover, focus.
8. **Microcopy**: Are labels, buttons, and messages clear and human?

If persona framing helps, use only these compact archetypes:

1. first-timer
2. power user
3. accessibility-dependent user

## Output

Return findings in this shape:

### Anti-Pattern Verdict

Pass or fail, with specific tells.

### Overall Impression

Short gut-level assessment.

### What's Working

List 2-3 concrete strengths.

### Priority Issues

List 3-5 issues with `P0-P3` severity. For each issue include:

- what is wrong
- why it matters
- the most direct fix

### Recommended Next Commands

Recommend the smallest useful next actions, using only relevant design commands.

Keep the critique direct, specific, and actionable. Do not soften findings with vague language.
