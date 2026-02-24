---
phase: 06-flatten-canonical-structure
plan: 01
subsystem: infra
tags: [path-constants, file-structure, refactor]

# Dependency graph
requires:
  - phase: 05-dead-code-cleanup-integration
    provides: Clean module structure with canonical.ts, render.ts, pull.ts, check.ts
provides:
  - Flat configs/ directory structure (no intermediate common/)
  - Path constants (CANONICAL_ROOT, COMMANDS_DIR, AGENTS_DIR, MCP_DIR, INSTRUCTIONS_DIR, SKILLS_DIR, SETTINGS_DIR)
  - All source/test/doc references updated to configs/
affects: [07-unify-instructions, 08-tools-repo-rename]

# Tech tracking
tech-stack:
  added: []
  patterns: [path-constants-over-string-concatenation]

key-files:
  created: []
  modified:
    - src/cli/canonical.ts
    - src/cli/render.ts
    - src/cli/pull.ts
    - src/cli/check.ts
    - src/cli/index.ts
    - src/cli/__tests__/orchestrator.test.ts
    - src/cli/__tests__/stale-and-pull.test.ts
    - SYNC.md
    - docs/architecture.md
    - docs/overview.md
    - docs/subagent.md
    - docs/runbooks/mcp-incident.md
    - configs/instructions/claude.md
    - configs/instructions/opencode.md
    - configs/instructions/codex.md
    - configs/instructions/gemini.md
    - configs/commands/zz-sync-agent-configs.md

key-decisions:
  - "Path constants in canonical.ts as single source of truth — all modules import from there"
  - "Plain mv instead of git mv — git detects renames automatically"
  - "Single atomic commit for all changes (file moves + code + docs)"

patterns-established:
  - "Path constants: import COMMANDS_DIR/AGENTS_DIR/etc from canonical.ts instead of string-concatenating configs/X"

requirements-completed: [STRUCT-01, STRUCT-02, STRUCT-03, STRUCT-04, STRUCT-05]

# Metrics
duration: 32min
completed: 2026-02-24
---

# Phase 6 Plan 01: Flatten Canonical Structure Summary

**Flattened configs/common/ to configs/ with path constants in canonical.ts and 97 files moved/updated in single atomic commit**

## Performance

- **Duration:** 32 min
- **Started:** 2026-02-24T09:20:28Z
- **Completed:** 2026-02-24T09:53:19Z
- **Tasks:** 1
- **Files modified:** 97 (85 renamed, 12 content-modified)

## Accomplishments
- Moved all 6 subdirectories (agents, commands, instructions, mcp, settings, skills) from configs/common/ to configs/
- Added CANONICAL_ROOT + 6 subdirectory path constants to canonical.ts — all modules now import paths instead of string-concatenating
- Updated all source code (canonical.ts, render.ts, pull.ts, check.ts, index.ts), tests (orchestrator.test.ts, stale-and-pull.test.ts), and 10 doc files
- Deleted configs/common/ directory entirely
- Zero grep hits for `configs/common` in src/, configs/, docs/

## Task Commits

Each task was committed atomically:

1. **Task 1: Move files, add path constants, update all source/test/doc references** - `a1d0879` (refactor)

## Files Created/Modified
- `src/cli/canonical.ts` - Added CANONICAL_ROOT + 6 exported path constants, updated all readCanonical* functions
- `src/cli/render.ts` - Updated error messages and readSingleCanonicalItem path
- `src/cli/pull.ts` - Updated 12 path references and doc strings
- `src/cli/check.ts` - Updated 2 sourcePath references
- `src/cli/index.ts` - Updated CLI description to reference configs/
- `src/cli/__tests__/orchestrator.test.ts` - Updated test fixture paths
- `src/cli/__tests__/stale-and-pull.test.ts` - Updated test fixture paths
- `SYNC.md` - Global replace of 18 occurrences
- `docs/architecture.md` - Updated 3 path references
- `docs/overview.md` - Updated 3 references + architecture tree
- `docs/subagent.md` - Updated 5 references
- `docs/runbooks/mcp-incident.md` - Updated 1 reference
- `configs/instructions/{claude,opencode,codex,gemini}.md` - Updated canonical path references
- `configs/commands/zz-sync-agent-configs.md` - Updated 3 path references
- 85 files renamed from `configs/common/X` to `configs/X`

## Decisions Made
- Path constants in canonical.ts as single source of truth — all modules import COMMANDS_DIR/AGENTS_DIR/etc instead of string-concatenating paths
- Plain `mv` instead of `git mv` — git detects renames automatically (97% similarity threshold)
- Single atomic commit for all changes per user preference

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated configs/commands/zz-sync-agent-configs.md references**
- **Found during:** Task 1 (doc updates step)
- **Issue:** Plan didn't list this file, but it contained 3 `configs/common/` references that would be stale
- **Fix:** Replaced all 3 occurrences of `configs/common/` with `configs/`
- **Files modified:** configs/commands/zz-sync-agent-configs.md
- **Verification:** grep confirms zero hits
- **Committed in:** a1d0879 (part of task commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical reference update)
**Impact on plan:** Essential for correctness — stale path references in command docs would confuse users. No scope creep.

## Issues Encountered
- AGENTS.md had no `configs/common` references in committed version (plan said line 168 existed) — skipped, no changes needed
- MCPORTER_ANALYSIS.md doesn't exist in committed tree (was in stashed v2.0 work) — skipped, no changes needed
- Working tree was dirty at plan start — stashed all pre-existing v2.0 work before execution
- Pre-existing test failures (16 fail, 4 errors) due to missing support-files module from stashed v2.0 work — confirmed our changes add zero regressions (same results before and after)
- `committer` tool unstaged pre-staged configs/ renames — fixed with `git add -A configs/` + amend

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- configs/ structure is flat and clean — ready for Phase 7 (Unify Instructions)
- Path constants established in canonical.ts — Phase 7 can extend/modify as needed
- Git stash contains v2.0 in-progress work (support-files module etc.) — should be popped before continuing

## Self-Check: PASSED

- FOUND: src/cli/canonical.ts
- FOUND: configs/agents/zz-planner.md
- CONFIRMED: configs/common/ does not exist
- FOUND: 06-01-SUMMARY.md
- FOUND: commit a1d0879

---
*Phase: 06-flatten-canonical-structure*
*Completed: 2026-02-24*
