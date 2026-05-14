---
name: interface-design
description: Use when designing or revising a public interface, module seam, API contract, adapter boundary, state model, or other hard-to-change shape where alternatives should be compared.
---

# Interface Design

## Overview

First designs are usually local maxima. Design the interface more than once, compare alternatives by leverage and locality, then choose deliberately.

## Vocabulary

| Term | Meaning |
|------|---------|
| Module | Anything with an interface and implementation: function, class, package, workflow, or slice. |
| Interface | Everything callers must know: types, invariants, ordering, errors, config, performance. |
| Seam | Place where behavior can change without editing callers. |
| Adapter | Concrete thing satisfying an interface at a seam. |
| Depth | Capability hidden behind a small interface. |
| Leverage | Benefit callers get from depth. |
| Locality | Maintenance benefit from concentrating change and verification. |

## When to Use

- User asks for API, CLI, schema, adapter, module, or state-machine design.
- A decision would be expensive to reverse once implemented.
- Tests are hard to write because the interface is unclear.
- Multiple callers or integrations will depend on the shape.

Do not use for small internal helpers where the interface is obvious and cheap to change.

## Process

1. Frame the problem space for the user:
   - constraints the interface must satisfy
   - likely callers
   - invariants and error modes
   - what should sit behind the seam
2. Dispatch 3+ subagents in parallel, each with a different design constraint:
   - Minimal interface: 1-3 entry points, maximum leverage.
   - Flexible interface: supports extension and varied callers.
   - Common-case interface: optimizes the dominant caller path.
   - Adapter-oriented interface: useful when external systems vary.
3. Require each subagent to return:
   - interface shape
   - usage example
   - hidden implementation responsibilities
   - dependency/adapters strategy
   - tradeoffs
4. Compare alternatives by depth, locality, seam placement, test surface, and failure modes.
5. Recommend one design or a small hybrid. Do not dump options without a strong read.

## Evaluation Heuristics

- Deletion test: if deleting the module removes complexity, it was probably pass-through. If complexity reappears across callers, it was earning its keep.
- One adapter means a hypothetical seam. Two adapters means a real seam.
- The interface is the test surface. If tests must pierce it, the shape is wrong.
- Avoid interfaces that expose ordering constraints callers should not need to know.
- Prefer narrow interfaces that make invalid states hard to represent.

## Output Shape

````md
## Recommendation

Choose Design B because ...

## Alternatives Compared

1. Minimal interface — strengths, weaknesses
2. Flexible interface — strengths, weaknesses
3. Common-case interface — strengths, weaknesses

## Interface Sketch

```ts
// concise sketch only
```

## Tradeoffs

- What this hides well
- What remains explicit
- What would force redesign later
````

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| One design only | Generate at least three materially different shapes. |
| Comparing aesthetics | Compare leverage, locality, seam placement, and tests. |
| Over-generalizing | Add flexibility only when callers or adapters justify it. |
| File-path thinking | Design contracts first; locate files later. |
