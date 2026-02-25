# Phase 11: Push E2E Tests - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

E2E tests verify that pushing each of the 6 config types (commands, agents, skills, settings, MCP, instructions) to all 4 CLI targets (claude, opencode, gemini, codex) produces correct output. 24 push test cells covered, plus --delete stale removal and idempotency checks. No new production code — test-only phase.

</domain>

<decisions>
## Implementation Decisions

### Test organization
- Split by config type: 6 files — `push-commands.test.ts`, `push-agents.test.ts`, `push-skills.test.ts`, `push-settings.test.ts`, `push-mcp.test.ts`, `push-instructions.test.ts`
- Files live in `src/cli/__tests__/` colocated with push module source
- Every test file uses `withTargetBackup` (backs up all 4 real target dirs) — simpler and safer
- Single push call per file, many assertions — one `withTargetBackup` block, push once with `--type X`, then assert all 4 targets
- Replace existing push tests in `orchestrator.test.ts` — new E2E tests supersede the old commands→claude-only coverage

### Assertion strategy
- Primary: golden file comparison — read pushed file, compare exact string match against golden fixture
- Also assert on `OrchestratorPushResult` object: `written` count, `hasDrift`, `rolledBack=false`
- For MCP and settings (merge targets): pre-populate target with known seed state, push, compare full merged output against golden
- On failure: use bun:test default output (expected vs received) — no custom diff helper

### Edge case coverage
- `--force --delete` stale removal tested per config-type file (describe block within each file)
- Idempotency tested per file: push, then re-push, assert second run reports 0 drift
- Rollback-on-failure: skip — already covered by unit tests
- Existing `orchestrator.test.ts` push tests deleted and replaced by new E2E suite

### MCP + Settings fixture gap
- Extend `test/generate-golden.ts` to add MCP + settings rendering (same pattern as commands/agents/skills/instructions)
- MCP golden: merged output from known seed — pre-populated target config with known entries, canonical pushed on top
- Settings golden: same as MCP — pre-populate with known settings, push canonical, compare merged output
- Seed files committed as fixtures: `test/fixtures/seeds/` with per-target pre-existing MCP + settings configs (explicit, reviewable, deterministic)

### Claude's Discretion
- Exact seed file content (minimal but representative)
- Internal describe/it structure within each test file
- Whether to use helper functions for repetitive assertion patterns
- How to handle skills support files (assets alongside SKILL.md) in assertions

</decisions>

<specifics>
## Specific Ideas

- Phase 10 decision: golden files generated via actual renderers (not hand-crafted) — extend this pattern for MCP + settings
- `withTargetBackup` from `test/helpers/backup.ts` already exists and handles try/finally restore
- `runPush()` returns `OrchestratorPushResult { diffs, hasDrift, written, failed, rolledBack, output }` — assert on this in addition to file content
- Existing `push.test.ts` (CLI flag mapping) stays — it tests flag parsing, not E2E push

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-push-e2e-tests*
*Context gathered: 2026-02-25*
