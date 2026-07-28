---
name: screenshot-workflow
description: >
  Screenshot asset workflow. Use when the user explicitly asks to capture,
  inspect, optimize, or replace an app or website screenshot. Do not invoke for
  general logos, icons, illustrations, or unrelated image assets.
---

# Screenshots

## Prerequisites

Check before starting:
- `sips` — built into macOS (no install needed)
- `imageoptim` — `brew install imageoptim-cli` (optional; skip optimization step if missing)

If `imageoptim` is not installed, warn the user and proceed without the optimization step.

## Workflow

1. Identify the exact screenshot from the user's path or request. If ambiguous, list likely candidates and ask rather than choosing by modification time.
2. Verify it's the right UI using dimensions and a preview when possible.
3. Size: `sips -g pixelWidth -g pixelHeight <file>` (prefer 2x for Retina).
4. Check file size against the target project's documented limit. If no limit exists, preserve quality and avoid speculative conversion.
5. Optimize (if imageoptim available): `imageoptim <file>`.
6. Replace the asset and run only the relevant project verification.

## Gotchas

- macOS screenshots are always PNG. Convert to JPG/WebP if the project expects it.
- Retina screenshots are 2x — verify the target asset dimensions before replacing.
- `sips` can resize: `sips -Z <max-dimension> <file>` if the screenshot is too large.
- Git LFS: if the repo uses LFS for images, ensure the file is tracked before committing.
