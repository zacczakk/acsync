---
phase: 08-tools-repo-rename
plan: 02
subsystem: infra
tags: [repo-rename, binary, path-resolution, stale-cleanup]

requires:
  - phase: 08-tools-repo-rename/01
    provides: TOOLS.md with ~/Repos/acsync paths, AGENTS.md quick reference
  - phase: 07-unify-instructions
    provides: Unified AGENTS.md output filenames for all 4 targets
provides:
  - "Repo at ~/Repos/acsync with all internal path references updated"
  - "Binary re-registered via bun link from new location"
  - "All 4 CLI targets synced with ~/Repos/acsync paths"
  - "Stale instruction files removed (OPENCODE.md, GEMINI.md, instructions.md)"
  - "OpenCode opencode.json instructions points to AGENTS.md"
  - "acsync works from any cwd (PROJECT_ROOT resolved from binary location)"
affects: []

tech-stack:
  added: []
  patterns: [import-meta-dir-resolution]

key-files:
  created: []
  modified:
    - configs/instructions/AGENTS.md
    - configs/commands/acsync-configs.md
    - configs/commands/acsync-helpers.md
    - configs/commands/groom-docs.md
    - configs/settings/opencode.json
    - src/cli/canonical.ts
    - src/cli/check.ts
    - src/cli/push.ts
    - src/cli/pull.ts
    - src/cli/diff.ts
    - src/cli/render.ts

key-decisions:
  - "Manual mv for rename (not git mv) — session boundary required"
  - "Settings sync (opencode.json instructions) fixed manually — push pipeline doesn't handle settings"
  - "Added PROJECT_ROOT via import.meta.dir to fix cwd-dependency (pre-existing bug, fixed during rename)"

patterns-established:
  - "PROJECT_ROOT: resolve repo root from import.meta.dir, not cwd() — enables running acsync from any directory"

requirements-completed: [REPO-01, REPO-02, REPO-03, REPO-04, REPO-05, REPO-06]

duration: 15min
completed: 2026-02-24
---

# Phase 8 Plan 2: Repo Rename Summary

**Repo renamed ~/Repos/agents → ~/Repos/acsync with all path refs updated, targets synced, stale files cleaned, and cwd-dependency bug fixed**

## Performance

- **Duration:** ~15 min (split across 2 sessions due to manual mv)
- **Session 1:** Tasks 1-2 (path refs + commit)
- **Session 2:** Tasks 3-4 (post-rename: bun link, test, push, cleanup, verify)
- **Tasks:** 4
- **Files modified:** 15

## Accomplishments
- All ~/Repos/agents references updated to ~/Repos/acsync across 9 files
- OpenCode opencode.json instructions changed from OPENCODE.md to AGENTS.md
- Binary re-registered with bun link from new location
- All 4 CLI targets synced (52 items, zero drift)
- Stale instruction files removed (OPENCODE.md, GEMINI.md, instructions.md)
- Fixed pre-existing bug: acsync now works from any cwd via PROJECT_ROOT

## Task Commits

Each task was committed atomically:

1. **Task 1: Update path references** - `6ff2c59` (feat)
2. **Task 2: Commit + pre-rename checks** - `02e1ca5` (docs: STATE.md checkpoint)
3. **Task 3: Post-rename ops** - no separate commit (push/link/cleanup are runtime ops)
4. **Task 4: Human verify** - approved after all checks passed

**Bonus fix:** `415cd73` (fix: resolve project dir from binary location, not cwd)

## Files Created/Modified
- `configs/instructions/AGENTS.md` — ~25 path refs updated
- `configs/commands/acsync-configs.md` — 5 path refs updated
- `configs/commands/acsync-helpers.md` — 4 path refs updated
- `configs/commands/groom-docs.md` — 1 path ref updated
- `configs/settings/opencode.json` — instructions → AGENTS.md
- `SYNC.md` — 3 path refs updated
- `docs/subagent.md` — 1 path ref updated
- `docs/plans/active/vsync-alignment/PLAN.md` — 1 path ref updated
- `docs/plans/active/simplify-canonical/PLAN.md` — 5 path refs updated
- `src/cli/canonical.ts` — Added PROJECT_ROOT export
- `src/cli/check.ts` — Use PROJECT_ROOT instead of cwd()
- `src/cli/push.ts` — Use PROJECT_ROOT instead of cwd()
- `src/cli/pull.ts` — Use PROJECT_ROOT instead of cwd()
- `src/cli/diff.ts` — Use PROJECT_ROOT instead of cwd()
- `src/cli/render.ts` — Use PROJECT_ROOT instead of cwd()

## Decisions Made
- Manual `mv` required session boundary — committed code changes first, then user renamed, then new session for post-rename ops
- Settings (opencode.json) not part of push pipeline — fixed instructions path manually in target file
- Fixed cwd-dependency during verification: `import.meta.dir` resolves repo root regardless of where acsync is invoked

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] acsync cwd-dependency**
- **Found during:** Task 4 (human verification)
- **Issue:** `acsync check` from any dir other than repo root showed `(no items)` because canonical root resolved relative to cwd()
- **Fix:** Added `PROJECT_ROOT = resolve(import.meta.dir, '..', '..')` to canonical.ts; replaced all `cwd()` defaults with `PROJECT_ROOT`
- **Files modified:** src/cli/canonical.ts, check.ts, push.ts, pull.ts, diff.ts, render.ts
- **Verification:** `acsync check --pretty` from `~` shows all 52 items
- **Committed in:** `415cd73`

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for usability. No scope creep.

## Issues Encountered
- Settings sync gap: `acsync push` doesn't handle settings type. OpenCode opencode.json instructions path had to be fixed manually. Noted as future improvement.

## User Setup Required
None — repo rename + binary re-registration handled in-session.

## Next Phase Readiness
- Phase 8 complete — all v2.0 milestone goals achieved
- No further phases planned
- Settings sync gap noted for potential v2.1 work

---
*Phase: 08-tools-repo-rename*
*Completed: 2026-02-24*
