---
phase: 01-foundation
plan: 02
subsystem: formats
tags: [json, jsonc, toml, markdown, frontmatter, parser, gray-matter, smol-toml, jsonc-parser]

requires:
  - phase: 01-foundation
    provides: ParseError from src/errors.ts
provides:
  - readJson/writeJson for plain JSON config files
  - readJsonc/modifyJsonc for JSONC with comment preservation
  - readToml/writeToml for TOML config files
  - parseFrontmatter/stringifyFrontmatter for Markdown frontmatter
affects: [02-rendering, 03-sync-engine]

tech-stack:
  added: [jsonc-parser@3.3.1, smol-toml@1.6.0, gray-matter@4.0.3]
  patterns: [pure-string-parsers, ParseError-wrapping]

key-files:
  created:
    - src/formats/json.ts
    - src/formats/jsonc.ts
    - src/formats/toml.ts
    - src/formats/markdown.ts
    - src/formats/__tests__/json.test.ts
    - src/formats/__tests__/jsonc.test.ts
    - src/formats/__tests__/toml.test.ts
    - src/formats/__tests__/markdown.test.ts
  modified:
    - package.json

key-decisions:
  - "Format parsers operate on strings, not files (I/O handled by infra layer)"
  - "JSONC uses jsonc-parser modify+applyEdits for comment-preserving edits"
  - "smol-toml chosen over @iarna/toml (TOML 1.1 compliant, smaller)"

patterns-established:
  - "Pure functions: parse(string) -> data, stringify(data) -> string"
  - "All parse errors wrapped in ParseError with operation context"
  - "No file I/O in format modules — separation of concerns"

requirements-completed: [DIFF-01, FILE-01]

duration: 8min
completed: 2026-02-20
---

# Phase 1 Plan 2: Format Parsers Summary

**JSON, JSONC (comment-preserving), TOML, and Markdown frontmatter parsers using jsonc-parser, smol-toml, and gray-matter**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-20T12:12:42Z
- **Completed:** 2026-02-20T12:20:57Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- JSON read/write with consistent error handling and trailing newline
- JSONC read/modify with full comment preservation through edit operations
- TOML parse/stringify preserving integer vs float distinction
- Markdown frontmatter parse/stringify with edge case handling (empty, missing, body separators)
- 36 tests across 4 test files — all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Install deps and create JSON + JSONC parsers** - `f87d211` (feat)
2. **Task 2: TOML and Markdown frontmatter parsers** - `51535ff` (feat)

## Files Created/Modified
- `src/formats/json.ts` - readJson/writeJson with ParseError wrapping
- `src/formats/jsonc.ts` - readJsonc/modifyJsonc with comment preservation via jsonc-parser
- `src/formats/toml.ts` - readToml/writeToml using smol-toml
- `src/formats/markdown.ts` - parseFrontmatter/stringifyFrontmatter using gray-matter
- `src/formats/__tests__/json.test.ts` - 8 tests: parsing, errors, round-trip
- `src/formats/__tests__/jsonc.test.ts` - 10 tests: comments, trailing commas, nested paths, round-trip
- `src/formats/__tests__/toml.test.ts` - 10 tests: types, nested tables, inline tables, round-trip
- `src/formats/__tests__/markdown.test.ts` - 8 tests: frontmatter extraction, edge cases, round-trip
- `package.json` - Added jsonc-parser, smol-toml, gray-matter dependencies

## Decisions Made
- Format parsers are pure string-in/string-out functions — no file I/O (handled by infra layer)
- JSONC uses `modify()` + `applyEdits()` from jsonc-parser (same pattern as vsync) for comment preservation
- smol-toml chosen over @iarna/toml per research (TOML 1.1, smaller bundle)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 format parsers ready for Phase 2 rendering adapters
- Parsers provide the read/write primitives needed by CLI-specific renderers
- No blockers for subsequent plans

---
*Phase: 01-foundation*
*Completed: 2026-02-20*

## Self-Check: PASSED
