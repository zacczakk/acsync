---
phase: 08-tools-repo-rename
plan: 01
subsystem: docs
tags: [tools, documentation, progressive-disclosure]

requires:
  - phase: 07-unify-instructions
    provides: Unified AGENTS.md with CLI-specific notes
provides:
  - "Canonical TOOLS.md reference document at configs/instructions/TOOLS.md"
  - "Slim ## Tools section in AGENTS.md pointing to TOOLS.md"
affects: [08-02-repo-rename]

tech-stack:
  added: []
  patterns: [progressive-disclosure-via-reference]

key-files:
  created: [configs/instructions/TOOLS.md]
  modified: [configs/instructions/AGENTS.md]

key-decisions:
  - "TOOLS.md uses ~/Repos/acsync paths (repo rename preparation)"
  - "Quick reference kept to 4 most-used tools (acsync, committer, trash, gh)"

patterns-established:
  - "Reference-only files: configs/instructions/ can hold docs that agents Read on demand but are never rendered to targets"

requirements-completed: [TOOL-01, TOOL-02, TOOL-03]

duration: 1min
completed: 2026-02-24
---

# Phase 8 Plan 1: TOOLS.md + AGENTS.md Reference Summary

**Canonical TOOLS.md with 11 tool sections; AGENTS.md ## Tools slimmed from 40 lines to 8-line quick reference pointing to TOOLS.md by absolute path**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-24T18:20:51Z
- **Completed:** 2026-02-24T18:22:34Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `configs/instructions/TOOLS.md` with comprehensive tool documentation (11 sections, 154 lines)
- Slimmed AGENTS.md `## Tools` from 40 lines of inline docs to 8-line quick reference
- All paths use `~/Repos/acsync` (repo rename preparation)
- TOOL-03 verified by architecture: no `src/` code references TOOLS.md

## Task Commits

Each task was committed atomically:

1. **Task 1: Create configs/instructions/TOOLS.md** - `0e7ec09` (feat)
2. **Task 2: Update AGENTS.md ## Tools section** - `f7444cd` (refactor)

## Files Created/Modified
- `configs/instructions/TOOLS.md` — Canonical tool-use documentation (acsync, committer, trash, generate-docs, browser-tools, gh, tmux, mcporter, MCP servers, common CLI, evaluated tools)
- `configs/instructions/AGENTS.md` — Slimmed ## Tools section with TOOLS.md reference

## Decisions Made
- TOOLS.md uses `~/Repos/acsync` paths throughout (Plan 02 does global `agents` → `acsync` rename)
- Quick reference limited to 4 most-used tools; full catalog lives in TOOLS.md

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ready for 08-02 (global repo rename from `agents` to `acsync`)
- TOOLS.md already uses new paths; AGENTS.md still has old `~/Repos/agents` refs in other sections (Plan 02 scope)

## Self-Check: PASSED

---
*Phase: 08-tools-repo-rename*
*Completed: 2026-02-24*
