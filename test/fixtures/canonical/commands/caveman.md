---
description: >-
  Toggle compressed-response mode for the current OpenCode session. Levels:
  lite, full, ultra. Disable with off.
---

# Caveman Mode

Compressed voice mode. Sticky for the current OpenCode session, in-memory only — does not persist across sessions or restarts.

User input: $ARGUMENTS

## Behavior

- bare `/caveman` activates `full` for this session
- `/caveman lite`, `/caveman full`, `/caveman ultra` set an explicit level
- `/caveman off` (alias `/caveman stop`) disables compression for this session
- ending the session also clears the mode

## Notes

- Reverts to normal clarity for safety, destructive actions, multi-step ambiguity, or explicit clarification requests.
- See the `caveman` skill for level-by-level rules.
