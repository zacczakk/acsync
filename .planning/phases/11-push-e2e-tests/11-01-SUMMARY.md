---
phase: 11-push-e2e-tests
plan: 01
subsystem: testing
tags: [fixtures, golden-files, seeds, mcp, settings, merge-testing]

requires:
  - phase: 10-03
    provides: "Golden file generation infrastructure and canonical fixtures"
provides:
  - "Seed fixtures for MCP merge testing across all 4 targets"
  - "Seed fixtures for settings merge testing (claude + opencode)"
  - "MCP golden files showing rendered output merged into seed state"
  - "Settings golden files showing rendered output merged into seed state"
  - "Extended generate-golden.ts covering all 6 config types"
affects: [11-push-e2e-tests]

tech-stack:
  added: []
  patterns: ["seed-based merge testing — golden fixtures generated from seeds + canonical via actual adapters"]

key-files:
  created:
    - test/fixtures/seeds/claude/mcp.json
    - test/fixtures/seeds/claude/settings.json
    - test/fixtures/seeds/opencode/mcp.jsonc
    - test/fixtures/seeds/opencode/settings.jsonc
    - test/fixtures/seeds/gemini/mcp.json
    - test/fixtures/seeds/codex/mcp.toml
    - test/fixtures/claude/mcp/settings.json
    - test/fixtures/claude/settings/settings.json
    - test/fixtures/opencode/mcp/opencode.jsonc
    - test/fixtures/opencode/settings/opencode.json
    - test/fixtures/gemini/mcp/settings.json
    - test/fixtures/codex/mcp/mcp_servers.toml
  modified:
    - test/generate-golden.ts
    - src/cli/__tests__/orchestrator.test.ts

key-decisions:
  - "MCP goldens reflect actual adapter behavior — non-canonical servers removed on push (not preserved) per removesNonCanonicalOnPush()"
  - "Settings goldens show merge behavior — non-canonical keys preserved, canonical keys overwrite"

patterns-established:
  - "Seed fixture pattern: test/fixtures/seeds/{target}/ provides pre-existing target state for merge/overwrite testing"

requirements-completed: [PUSH-04, PUSH-05]

duration: 5min
completed: 2026-02-25
---

# Phase 11 Plan 01: Seed Fixtures and Golden Generation for MCP + Settings Summary

**Seed fixtures for all MCP/settings targets with extended golden generation covering all 6 config types**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-25T11:48:48Z
- **Completed:** 2026-02-25T11:54:34Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Created seed fixtures in test/fixtures/seeds/ for 4 MCP targets and 2 settings targets
- Extended generate-golden.ts to render MCP + settings goldens via actual adapters with seed merge
- Removed 7 superseded runPush tests from orchestrator.test.ts (new E2E tests in Plans 02/03)
- Total golden file count increased from 28 to 34

## Task Commits

Each task was committed atomically:

1. **Task 1: Create seed fixtures and extend golden generation for MCP + settings** - `13ad985` (feat)
2. **Task 2: Remove superseded push tests from orchestrator.test.ts** - `f191d0d` (refactor)

## Files Created/Modified
- `test/fixtures/seeds/claude/mcp.json` - Claude MCP seed with existing-server
- `test/fixtures/seeds/claude/settings.json` - Claude settings seed with customKey
- `test/fixtures/seeds/opencode/mcp.jsonc` - OpenCode MCP seed (JSONC with comment)
- `test/fixtures/seeds/opencode/settings.jsonc` - OpenCode settings seed (JSONC)
- `test/fixtures/seeds/gemini/mcp.json` - Gemini MCP seed
- `test/fixtures/seeds/codex/mcp.toml` - Codex MCP seed (TOML, HTTP server)
- `test/fixtures/claude/mcp/settings.json` - Claude MCP golden (canonical servers only)
- `test/fixtures/opencode/mcp/opencode.jsonc` - OpenCode MCP golden (JSONC comment preserved)
- `test/fixtures/gemini/mcp/settings.json` - Gemini MCP golden
- `test/fixtures/codex/mcp/mcp_servers.toml` - Codex MCP golden (HTTP-only: context7)
- `test/fixtures/claude/settings/settings.json` - Claude settings golden (env + permissions merged, customKey preserved)
- `test/fixtures/opencode/settings/opencode.json` - OpenCode settings golden (all canonical keys merged, customKey preserved)
- `test/generate-golden.ts` - Extended with MCP + settings rendering sections
- `src/cli/__tests__/orchestrator.test.ts` - Removed runPush describe block

## Decisions Made
- MCP goldens correctly reflect adapter overwrite behavior (non-canonical servers removed) — this is by design per removesNonCanonicalOnPush()
- Settings goldens correctly reflect merge behavior (non-canonical keys preserved)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 6 config types now have golden fixtures (commands, agents, skills, instructions, MCP, settings)
- Ready for Plan 02: push E2E tests for commands/agents/skills/instructions
- Ready for Plan 03: push E2E tests for MCP and settings

---
*Phase: 11-push-e2e-tests*
*Completed: 2026-02-25*
