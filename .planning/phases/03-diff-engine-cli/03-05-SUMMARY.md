---
phase: 03-diff-engine-cli
plan: "05"
subsystem: adapters
tags: [skills, gemini, codex, secrets, orchestrator]

requires:
  - phase: 03-diff-engine-cli
    provides: orchestrator runPush, adapter capabilities, path-resolver

provides:
  - GeminiAdapter with skills: true
  - CodexAdapter with skills: true
  - Skills written to ~/.gemini/skills/ and ~/.codex/skills/
  - Orchestrator runPush without secret injection (${VAR} placeholders written as-is)
  - check after push shows 0 MCP drift

affects: []

tech-stack:
  added: []
  patterns:
    - "Rendered content written verbatim — no secret substitution; CLIs read env vars natively"
    - "Adapter capabilities gate: caps.skills === true enables skill push for that target"

key-files:
  created: []
  modified:
    - src/adapters/gemini.ts
    - src/adapters/codex.ts
    - src/adapters/__tests__/gemini.test.ts
    - src/adapters/__tests__/codex.test.ts
    - src/cli/orchestrator.ts

key-decisions:
  - "Write ${VAR} placeholders as-is; each CLI reads env vars natively (no injectSecrets)"
  - "path-resolver default case (baseDir + skills/) correctly resolves for gemini and codex — no change needed"
  - "Skills test path assertions use trailing slash to match path.join behavior with 'skills/' input"

patterns-established:
  - "caps.skills gate: adapter declares capability, orchestrator checks before processing skill ops"

requirements-completed: [RNDR-13, SECR-01, CLI-04]

duration: 5min
completed: 2026-02-21
---

# Phase 3 Plan 05: Skills for Gemini/Codex + Remove Secret Injection Summary

**Skills enabled for all 4 CLIs; check after push shows 0 drift — ${VAR} placeholders written verbatim**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-21T14:40:24Z
- **Completed:** 2026-02-21T14:45:54Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- GeminiAdapter and CodexAdapter both declare `skills: true` — skills now push to `~/.gemini/skills/` and `~/.codex/skills/`
- Removed `injectSecrets` + `loadSecrets` from orchestrator `runPush` — rendered content written as-is with `${VAR}` placeholders
- `check` after `push` shows 0 drift for all targets (44 items all "skip") — no perpetual hash mismatch

## Task Commits

Each task was committed atomically:

1. **Task 1: Enable skills in Gemini + Codex adapters; fix skill paths** - `9470031` (feat)
2. **Task 2: Remove secret injection from orchestrator** - `b287b19` (feat)

**Plan metadata:** TBD (docs commit)

## Files Created/Modified

- `src/adapters/gemini.ts` — `skills: false` → `skills: true`
- `src/adapters/codex.ts` — `skills: false` → `skills: true`
- `src/adapters/__tests__/gemini.test.ts` — Updated capability test + added skill path assertion
- `src/adapters/__tests__/codex.test.ts` — Updated capability test + added skill path assertion
- `src/cli/orchestrator.ts` — Removed `loadSecrets` call, `injectSecrets` call, and both imports from `runPush`

## Decisions Made

- Write `${VAR}` placeholders as-is: each CLI (Claude Code, Gemini, OpenCode) reads env vars natively, so no substitution needed at sync time. Removing injection ensures manifest hashes match on-disk hashes → no perpetual drift on `check`.
- `path-resolver.ts` default case (`path.join(rawBaseDir(), 'skills/')`) already produces correct paths for gemini (`~/.gemini/skills/`) and codex (`~/.codex/skills/`) — no changes required.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Skill path test assertions used wrong expected value (missing trailing slash)**
- **Found during:** Task 1 (running tests)
- **Issue:** Test used `path.join(HOME, '.gemini/skills')` (no trailing slash) but actual path from `path.join('~/.gemini', 'skills/')` expands to `/…/.gemini/skills/` (with trailing slash, preserved by Node.js `path.join`)
- **Fix:** Changed expected to `path.join(HOME, '.gemini/skills/')` and `path.join(HOME, '.codex/skills/')`
- **Files modified:** gemini.test.ts, codex.test.ts
- **Verification:** Tests pass (37/37 in targeted run)
- **Committed in:** `9470031` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary fix for test correctness. No scope creep.

## Issues Encountered

- 3-4 pre-existing test failures in `src/adapters/__tests__/skills.test.ts` and `src/core/__tests__/rollback.test.ts` (referencing `ralph-tui-create-beads` skill not present in `~/.claude/skills/`, and a flaky timing test). These pre-existed before this plan's changes and are out of scope.

## Next Phase Readiness

Phase 3 complete. All UAT gaps closed:
- Skills push to all 4 CLIs (claude-code, opencode, gemini, codex) ✓
- check after push shows 0 MCP drift ✓
- ${VAR} placeholders written as-is ✓

Ready for milestone completion.

---
*Phase: 03-diff-engine-cli*
*Completed: 2026-02-21*
