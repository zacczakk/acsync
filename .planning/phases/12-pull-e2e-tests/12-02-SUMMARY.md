---
phase: 12-pull-e2e-tests
plan: 02
subsystem: testing
tags: [pull, e2e, commands, agents, skills, golden-comparison, reverse-parse]

requires:
  - phase: 12-pull-e2e-tests
    provides: parseMCPServers reverse-parser, MCP/instructions pull pipeline
  - phase: 11-push-e2e-tests
    provides: push golden fixtures for all 4 targets
provides:
  - E2E pull tests for commands across 4 targets (PULL-01)
  - E2E pull tests for agents across 4 targets (PULL-02)
  - E2E pull tests for skills across 2 targets (PULL-03)
  - Force overwrite verification for pull (PULL-07)
affects: [12-pull-e2e-tests]

tech-stack:
  added: []
  patterns: [plant target fixtures → pull → compare canonical output, structural body comparison for lossy adapters]

key-files:
  created:
    - test/__tests__/pull-commands.test.ts
    - test/__tests__/pull-agents.test.ts
    - test/__tests__/pull-skills.test.ts
  modified: []

key-decisions:
  - "Claude/OpenCode commands are identity passthrough — pulled output matches canonical exactly"
  - "Gemini TOML and Codex flat MD reverse-parse loses some metadata keys — tests verify description + body structural match"
  - "OpenCode agents lose name/allowed-tools and gain mode:subagent — structural body comparison used"
  - "Gemini agents lose name, gain kind:local — structural body comparison used"
  - "Skills are identity passthrough for all targets — exact match verified for Claude and OpenCode"

patterns-established:
  - "Plant target-format fixtures → runPull → golden comparison to canonical: symmetric with push tests"
  - "Lossy adapters get structural assertions (description present + body match) vs exact match"

requirements-completed: [PULL-01, PULL-02, PULL-03, PULL-07]

duration: 15min
completed: 2026-02-25
---

# Phase 12 Plan 02: Pull E2E Tests for Commands, Agents, Skills Summary

**E2E pull tests verifying reverse-parse from all 4 target formats back to canonical with golden comparison and force/skip behavior**

## Performance

- **Duration:** 15 min
- **Started:** 2026-02-25T14:19:40Z
- **Completed:** 2026-02-25T14:35:14Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments
- 3 pull-commands tests: golden match (Claude identity), structural match (Gemini TOML, Codex flat MD), skip/force behavior
- 2 pull-agents tests: golden match (Claude identity), structural match (OpenCode/Gemini/Codex lossy), force overwrite
- 2 pull-skills tests: exact canonical match from Claude and OpenCode (identity passthrough)
- 7 total test cases, 24 expect() assertions covering PULL-01, PULL-02, PULL-03, PULL-07

## Task Commits

Each task was committed atomically:

1. **Task 1: Write pull-commands.test.ts E2E test** - `d0030b1` (test)
2. **Task 2: Write pull-agents.test.ts and pull-skills.test.ts E2E tests** - `1c9b465` (test)

## Files Created/Modified
- `test/__tests__/pull-commands.test.ts` - E2E pull tests for commands across 4 targets (118 lines)
- `test/__tests__/pull-agents.test.ts` - E2E pull tests for agents across 4 targets (102 lines)
- `test/__tests__/pull-skills.test.ts` - E2E pull tests for skills from Claude and OpenCode (68 lines)

## Decisions Made
- Claude/OpenCode pull is identity passthrough for commands — exact canonical match asserted
- Lossy adapters (Gemini TOML, Codex flat MD) lose metadata keys on push → pull roundtrip — tests verify structural match (description + body content) instead of exact match
- OpenCode agents strip name/allowed-tools and add mode:subagent on push — reverse-parse recovers what the target format retains
- Skills are identity passthrough for all targets — tested Claude and OpenCode for full coverage

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed agent assertions for lossy adapters**
- **Found during:** Task 2 (pull-agents.test.ts)
- **Issue:** Plan suggested OpenCode/Gemini agent pull would match canonical exactly, but OpenCode strips name/allowed-tools (adds mode:subagent) and Gemini strips name (adds kind:local) on push — so pull can't recover those keys
- **Fix:** Changed assertions from exact match to structural match (description present + body content matches canonical body)
- **Files modified:** test/__tests__/pull-agents.test.ts
- **Verification:** All tests pass
- **Committed in:** 1c9b465

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Correct test assertions for adapter metadata behavior. No scope creep.

## Issues Encountered

Pre-existing test failure (1 of 457): `runPullAll > items present in multiple targets appear under each source` — expects opencode skills dir at `~/.config/opencode/skill/` which doesn't exist on this machine. Not caused by this plan's changes. Same as documented in 12-01-SUMMARY.md.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Pull E2E tests for commands, agents, and skills are complete
- Ready for plan 12-03 (pull E2E tests for MCP, instructions, settings)

## Self-Check: PASSED

- All key-files.created exist on disk
- Commit d0030b1 found in git log
- Commit 1c9b465 found in git log

---
*Phase: 12-pull-e2e-tests*
*Completed: 2026-02-25*
