---
name: frontend-design
description: >-
  Create distinctive, production-grade frontend interfaces with high design
  quality. Use this skill when the user asks to build web components, pages,
  artifacts, posters, or applications (examples include websites, landing pages,
  dashboards, React components, HTML/CSS layouts, or when styling/beautifying
  any web UI). Generates creative, polished code and UI design that avoids
  generic AI aesthetics.
license: Complete terms in LICENSE.txt
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic AI aesthetics. Implement real working code with strong design judgment and clear intentionality.

## Context Protocol

Before designing or coding:

1. Check loaded instructions for project design context.
2. Check `.design-context.md` in the project root.
3. If context is still missing, ask only for the minimum missing information.

Do not infer audience, jobs-to-be-done, brand personality, or emotional tone from code alone.

## Design Direction

Commit to a clear point of view:

- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick a distinct direction and execute it precisely.
- **Constraints**: Honor framework, accessibility, performance, and product constraints.
- **Differentiation**: Make at least one memorable choice that fits the context.

Bold maximalism and refined minimalism can both work. The key is intentionality.

## Design Priorities

Focus on:

- **Typography**: Choose fonts and hierarchy intentionally. Avoid invisible defaults when personality matters.
- **Color & Theme**: Use a cohesive palette with clear hierarchy and contrast. Prefer tinted neutrals over pure black and pure white defaults.
- **Motion**: Use animation to clarify, guide, or delight. Favor transform and opacity over layout-affecting motion.
- **Spatial Composition**: Use spacing and layout to create rhythm, hierarchy, and breathing room.
- **Visual Detail**: Add depth, texture, and atmosphere only when they serve the direction.

## Implementation Rules

- App UIs use fixed `rem`-based type scales. Reserve fluid sizing for display or marketing contexts.
- Prefer `gap` over margins for sibling spacing.
- Use Flexbox by default for 1D layouts. Use Grid for real 2D problems.
- Match implementation complexity to the design direction. Refined work needs restraint; expressive work needs precision.

## Anti-Patterns

Never default to:

- hero-metric templates
- decorative gradient text
- dark-mode glow palettes
- glassmorphism everywhere
- icon-over-heading templates
- identical card grids repeated across the page
- arbitrary spacing with no rhythm
- generic font defaults and interchangeable SaaS layouts

Avoid AI slop signals. The UI should feel designed for this product, not generated from a template.

## Output Standard

Implement working code that is:

- production-grade and functional
- visually distinctive
- cohesive and context-aware
- accessible and responsive
- refined at the level of spacing, hierarchy, and states

Interpret creatively, but stay grounded in the product context. No two outputs should converge on the same safe default style.
