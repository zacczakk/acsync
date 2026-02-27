---
name: screenshot-workflow
description: >
  Screenshot asset workflow. Use when user says "use a screenshot" or task
  involves replacing, optimizing, or committing image/UI assets.
---

# Screenshots

- Pick newest PNG in `~/Desktop` or `~/Downloads`.
- Verify it's the right UI (ignore filename).
- Size: `sips -g pixelWidth -g pixelHeight <file>` (prefer 2×).
- Optimize: `imageoptim <file>` (install: `brew install imageoptim-cli`).
- Replace asset; keep dimensions; commit; run gate; verify CI.
