# Phase 10: Fixtures Infrastructure + Test Health - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Committed fixture data and backup/restore test harness exist. All existing tests pass on a clean baseline before new E2E tests are added in Phases 11-12. This phase builds infrastructure and achieves health — it does not add new E2E push/pull test assertions (those are Phases 11 and 12).

</domain>

<decisions>
## Implementation Decisions

### Fixture data design
- Derived from real canonical configs in `configs/` — not synthetic
- All 6 config types covered upfront: commands, agents, skills, settings, MCP, instructions
- 2-3 fixtures per type to cover variations (e.g., with/without frontmatter, with/without secrets)
- Per-target expected outputs are pre-generated golden files committed to git — tests compare rendered output against committed golden files
- When renderers change, golden files must be regenerated

### Fixture directory layout
- Type-first organization: `test/fixtures/canonical/{commands,agents,...}` for inputs, `test/fixtures/{claude,opencode,gemini,codex}/{commands,agents,...}` for expected outputs
- Filenames match real canonical config filenames — realistic, easy to cross-reference
- Per-target expected output directories are flat (no nested path structure) — tests verify content correctness, not path correctness
- No manifest file — test code discovers fixtures by scanning directory convention

### Backup/restore harness
- Per test file (suite) isolation — backup once at suite start, restore at suite end
- Backup scope includes both 4 target dirs (~/.claude, ~/.config/opencode, ~/.gemini, ~/.codex) AND canonical `configs/`
- Always restore after tests, even on success — real configs always returned to pre-test state
- Reusable utility pattern: shared helper like `withBackup(dirs, fn)` — DRY, consistent across test files

### Test health baseline
- Fix all failing tests first — zero failures before any new test code lands
- Tests run against real target directories on host (backup/restore protects them) — true E2E
- Health bar: `bun test` exits 0. No performance targets.

### Claude's Discretion
- Whether to add smoke tests that validate the harness works (basic fixture round-trip) — Claude determines what's needed to prove the infrastructure is functional
- Exact `withBackup` API signature and error handling
- Which specific configs to pick as the 2-3 representatives per type
- How to handle golden file regeneration workflow (script vs manual)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key constraint: fixtures must stay realistic by deriving from real configs, and the harness must be bulletproof (always-restore, try/finally).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-fixtures-infrastructure-test-health*
*Context gathered: 2026-02-25*
