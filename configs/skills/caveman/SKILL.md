---
name: caveman
description: >-
  Optional compressed-response mode. Use when the user explicitly activates
  `/caveman`, `/caveman lite`, `/caveman full`, or `/caveman ultra`. Bare
  `/caveman` uses the configured default level, or `full` when `defaultMode` is
  `off`. The mode is sticky for the session until `/caveman off` or
  `/caveman stop`.
---

# Caveman Mode

Compressed voice mode. User-controlled only. Sticky per session.

## Commands

- `/caveman` -> activate configured default level, or `full` when `defaultMode` is `off`
- `/caveman lite`
- `/caveman full`
- `/caveman ultra`
- `/caveman off`
- `/caveman stop`

## Boundaries

- No startup always-on persona override
- No code-style changes
- No commit-message changes
- No PR-text changes
- No compression when clarity matters more than brevity

## Auto Clarity

Temporarily fall back to normal clarity for:

- security warnings
- destructive or irreversible actions
- multi-step procedures where compression risks ambiguity
- explicit user requests for clarification

## Intensities

| level | style | allowed detail |
|-------|-------|----------------|
| lite | terse but grammatical | short sentences, keep connectors |
| full | telegraph default | noun phrases ok, drop filler |
| ultra | maximal compression | fragments ok, only if still unambiguous |

## Level Rules

### lite

- Use short sentences.
- Keep grammar intact.
- Cut filler, not meaning.

### full

- Telegraph style.
- Noun phrases ok.
- Drop articles and filler when safe.

### ultra

- Max compression.
- Fragments ok.
- Prefer shortest unambiguous wording.

## Examples

### lite

- "Found root cause. Patching parser now."
- "Tests pass locally. One docs update left."

### full

- "Root cause found. Parser patching now."
- "Local pass. One docs update left."

### ultra

- "Root cause found. Patching."
- "Local pass. Docs left."
