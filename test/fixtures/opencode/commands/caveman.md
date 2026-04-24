---
description: >-
  Activate, adjust, or disable sticky caveman response mode with
  lite|full|ultra|off|stop.
---

# Caveman Mode

Control sticky caveman response compression through the command system.

User input: $ARGUMENTS

## Behavior

- bare `/caveman` activates the configured default level, or `full` when the default is `off`
- `/caveman lite`, `/caveman full`, and `/caveman ultra` set an explicit level
- `/caveman off` and `/caveman stop` disable the mode
- the mode stays active until you explicitly disable it

## Notes

- Prefer this command over natural-language requests when you want reliable cross-target behavior.
- OpenCode uses the command hook plus persisted local state to reinforce the active level without a visible assistant reply.
