---
name: screenshot-workflow
description: >
  Screenshot asset workflow. Use when user says "use a screenshot" or task
  involves replacing, updating, optimizing, or committing image/UI assets
  such as hero images, logos, icons, app screenshots, or Open Graph images.
---

# Screenshots

## Prerequisites

Check before starting:
- `sips` — built into macOS (no install needed)
- `imageoptim` — `brew install imageoptim-cli` (optional; skip optimization step if missing)

If `imageoptim` is not installed, warn the user and proceed without the optimization step.

## Workflow

1. Pick newest PNG/JPG in `~/Desktop` or `~/Downloads`.
2. Verify it's the right UI (ignore filename — show dimensions and preview if possible).
3. Size: `sips -g pixelWidth -g pixelHeight <file>` (prefer 2x for Retina).
4. Optimize (if imageoptim available): `imageoptim <file>`.
5. Replace asset; keep dimensions; commit; run gate; verify CI.

## Gotchas

- macOS screenshots are always PNG. Convert to JPG/WebP if the project expects it.
- Retina screenshots are 2x — verify the target asset dimensions before replacing.
- `sips` can resize: `sips -Z <max-dimension> <file>` if the screenshot is too large.
- Git LFS: if the repo uses LFS for images, ensure the file is tracked before committing.
