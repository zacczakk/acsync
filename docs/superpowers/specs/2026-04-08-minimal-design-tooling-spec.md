# Minimal Design Tooling Spec

**Date:** 2026-04-08
**Status:** Draft
**Scope:** `frontend-design` upgrade, one new critique skill, six canonical design commands

## Context

Current metronome design coverage has two strengths and one gap:

1. `configs/skills/frontend-design/` is good at generating distinctive UI, but its current canonical version is a short-form distilled prompt with no persistent design-context mechanism and less specific anti-pattern coverage than upstream Impeccable.
2. `configs/skills/web-design-guidelines/` is good at standards and compliance review, but it is not a taste, UX, or anti-slop review layer.
3. There is no lean canonical command layer for repeated design passes such as audit, critique, normalize, polish, or typography cleanup.

Upstream Impeccable proves there is value in a stronger design context protocol and in command-shaped workflows. Full adoption is not the goal. The goal is to extract the smallest durable layer that improves Phil's existing setup without importing a 20-command command pack or a second broad generative design skill.

## Decision

Adopt a minimal Impeccable-inspired design tooling layer in metronome with:

1. a targeted upgrade to `frontend-design`
2. one new review skill: `design-critique`
3. six canonical commands:
   - `teach-design-context`
   - `design-audit`
   - `design-critique`
   - `design-normalize`
   - `design-polish`
   - `design-typeset`

Do not adopt a second broad generative design skill.

## Goals

1. Improve design quality without bloating the always-loaded instruction surface.
2. Separate UI generation from UI review and targeted cleanup.
3. Add a reusable design-context capture mechanism that works across projects.
4. Add a small command layer that fits metronome's canonical `configs/commands/` model.
5. Cover both technical review and taste/UX review without importing the full upstream command set.

## Non-Goals

1. Full upstream Impeccable sync.
2. All 20 upstream command-skills.
3. A branded `.impeccable.md` dependency in canonical form.
4. Automated CLI or CI slop detection.
5. A second generative design skill that overlaps `frontend-design`.
6. Adding all seven upstream reference files in v1.

## Artifact Changes

### Skills

1. Update `configs/skills/frontend-design/SKILL.md`
2. Add `configs/skills/design-critique/SKILL.md`

### Commands

Add six canonical command files under `configs/commands/`:

1. `teach-design-context.md`
2. `design-audit.md`
3. `design-critique.md`
4. `design-normalize.md`
5. `design-polish.md`
6. `design-typeset.md`

### Docs

Update `docs/skills.md` after implementation to reflect the new skill and design-command layer.

## Skill Design

### 1. `frontend-design`

`frontend-design` remains the primary generative design skill.

#### Additions

Add a slim Design Context protocol:

1. Check loaded instructions for project design context.
2. Check a local context file in project root.
3. If still missing, ask the user for the minimum missing context.

Use a neutral local file name:

`.design-context.md`

The skill should not assume the codebase alone can answer audience, jobs-to-be-done, brand personality, or emotional tone.

Add a slim anti-pattern expansion beyond the current canonical version:

1. hero-metric template defaults
2. gradient text used as decoration
3. dark-mode glow defaults
4. glassmorphism overuse
5. icon-above-heading template overuse
6. identical card-grid repetition
7. arbitrary spacing with no rhythm

Add a few high-value implementation rules:

1. app UIs use fixed `rem`-based type scales; fluid sizing reserved for display or marketing contexts
2. prefer `gap` over margins for sibling spacing
3. use Flexbox by default for 1D layouts; Grid for real 2D layout problems
4. tint neutrals; avoid pure black and pure white as defaults

#### Deliberate Omissions

Do not add:

1. all upstream prose verbatim
2. all seven reference files in v1
3. command-specific instructions inside the core skill
4. mandatory branded command names or Impeccable-specific file names

#### Success Condition

`frontend-design` should stay lean enough to auto-load when appropriate while becoming sharper on context and anti-slop guidance.

### 2. `design-critique`

Add a new review skill focused on UX, taste, hierarchy, and anti-slop detection.

#### Purpose

Review an existing interface and answer:

1. does it look generic or AI-generated?
2. does the hierarchy work?
3. does the information architecture make sense?
4. does the interface communicate clearly for its audience?
5. what are the highest-leverage next fixes?

#### Inputs

The skill should:

1. inspect the relevant code and UI files
2. use project design context if available
3. work even without a full design system

#### Output Shape

The skill should produce:

1. `Anti-pattern verdict` — pass/fail with specific tells
2. `Overall impression` — short gut-level assessment
3. `What's working` — 2-3 concrete strengths
4. `Priority issues` — 3-5 issues with `P0-P3` severity
5. `Recommended next commands` — ordered follow-up actions

#### Evaluation Areas

Keep the evaluation layer shorter than upstream `critique` but preserve the most useful parts:

1. anti-slop detection
2. visual hierarchy
3. cognitive load / information architecture
4. emotional tone and fit
5. discoverability and affordance
6. typography as communication
7. states and edge cases
8. microcopy clarity

#### Heuristics

Use Nielsen-style scoring as a compact framework, but keep the skill text lean. Do not copy the full upstream reference tree in v1.

#### Personas

Do not import the full upstream persona library in v1. If persona framing is included, keep it to at most three compact archetypes embedded directly in the skill:

1. first-timer
2. power user
3. accessibility-dependent user

#### Scope Boundary

`design-critique` is a review skill, not a mandatory edit skill. It may suggest follow-up commands, but it should not require changes during the critique step.

## Command Design

The command layer should map repeated design workflows onto canonical `configs/commands/` files.

These commands are task entrypoints, not second broad skills.

### 1. `teach-design-context`

Purpose: create or update `.design-context.md` for the current project.

#### Behavior

1. inspect repo docs, stack, existing UI patterns, tokens, and brand assets first
2. ask only what code cannot answer
3. write a concise reusable context note covering:
   - users
   - jobs to be done
   - brand personality
   - aesthetic direction
   - anti-references
   - accessibility expectations
   - design principles

#### Output File

`./.design-context.md`

#### Why

This is the highest-value upstream pattern. It makes later design work less generic without forcing long context gathering every time.

### 2. `design-audit`

Purpose: run a technical UI audit without editing code by default.

#### Review Areas

1. accessibility
2. performance
3. theming / token usage
4. responsiveness
5. anti-pattern detection

#### Output

1. compact score table
2. `P0-P3` issues
3. positive findings
4. recommended next commands

#### Positioning

This complements `web-design-guidelines` rather than replacing it. `web-design-guidelines` remains the external standards review path; `design-audit` is the internal design-quality audit path.

### 3. `design-critique`

Purpose: run the `design-critique` review through a command entrypoint.

#### Why

The skill is the review brain; the command makes invocation ergonomic and repeatable in daily use.

### 4. `design-normalize`

Purpose: realign a feature or page with an existing design system.

#### Focus

1. tokens
2. spacing
3. component consistency
4. motion and interaction consistency
5. design-system drift cleanup

#### Constraint

Only use when a repo actually has an established system or existing UI conventions to normalize toward.

### 5. `design-polish`

Purpose: perform the final quality pass before shipping.

#### Focus

1. spacing and alignment
2. interaction-state completeness
3. copy consistency
4. error/loading/empty-state quality
5. micro-detail cleanup

#### Constraint

Polish is the last step, not the first. It should assume the feature is already functionally complete.

### 6. `design-typeset`

Purpose: improve typography without broad layout or system rework.

#### Focus

1. font choice
2. hierarchy
3. sizing and scale
4. weight consistency
5. readability and line length

#### Why This Made the Cut

Typography is high leverage, narrow in scope, and frequently worth a targeted pass. It provides more focused value than importing both `typeset` and `arrange` in v1.

## Naming

Use neutral canonical names owned by metronome:

1. `design-critique` skill
2. `teach-design-context` command
3. `design-audit` command
4. `design-critique` command
5. `design-normalize` command
6. `design-polish` command
7. `design-typeset` command

Reason:

1. avoids upstream branding bleed
2. leaves room to evolve independently
3. keeps command purpose obvious from the name alone

## Workflow

Expected usage flow:

1. run `teach-design-context` once per project when context is unclear
2. create or modify UI with `frontend-design`
3. run `design-audit` for technical quality issues
4. run `design-critique` for UX, hierarchy, and anti-slop review
5. run a targeted follow-up:
   - `design-normalize` when system consistency is the problem
   - `design-typeset` when typography is the problem
6. finish with `design-polish`

This keeps the workflow legible and avoids command sprawl.

## Why Not Add More Commands

The following upstream commands are intentionally out of scope for v1:

1. `arrange`
2. `animate`
3. `adapt`
4. `clarify`
5. `extract`
6. `bolder`
7. `quieter`
8. `delight`
9. `colorize`
10. `overdrive`
11. `onboard`

Reasons:

1. too narrow for initial adoption
2. too vibe-shaped or subjective for canonical inclusion
3. overlap with direct editing instructions or existing skills
4. easier to add later than remove after sync and habit formation

## Success Criteria

1. `frontend-design` becomes sharper on context and anti-slop without becoming bloated.
2. `design-critique` fills the UX/taste review gap not covered by `web-design-guidelines`.
3. The command layer fits metronome's existing canonical command model.
4. The command surface stays at six or fewer design commands.
5. The system clearly separates generation, critique, normalization, and final polish.
6. The design workflow becomes more repeatable without importing the full upstream package.

## Open Questions

1. Should `.design-context.md` stay local-only, or also support appending to per-tool config later?
2. Should `frontend-design` get a single short `reference/anti-patterns.md` file in v1, or stay single-file?
3. Should `design-critique` exist as both a skill and a command alias from day one, or should the command be added only after the skill proves useful?

## Recommended Default Answers

1. local-only `.design-context.md` in v1
2. single-file `frontend-design` in v1 unless the anti-pattern section becomes unwieldy
3. yes, ship both the `design-critique` skill and command together

## Implementation Order

1. update `frontend-design`
2. add `design-critique` skill
3. add `teach-design-context`, `design-audit`, and `design-critique`
4. add `design-normalize`, `design-polish`, and `design-typeset`
5. update `docs/skills.md`
6. sync and verify on OpenCode, Claude Code, Gemini CLI, and Codex
