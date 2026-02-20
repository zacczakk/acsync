---
phase: 02-renderers-secrets
plan: 03
subsystem: adapters
tags: [mcp, renderers, claude-code, opencode, gemini, codex, jsonc, toml, env-vars, instructions]

requires:
  - phase: 02-renderers-secrets
    provides: BaseAdapter, ClaudeCodeAdapter, OpenCodeAdapter, GeminiAdapter, CodexAdapter stubs + writeJson/writeToml/modifyJsonc/EnvVarTransformer

provides:
  - ClaudeCodeAdapter.renderMCPServers: JSON mcpServers key, merge with existing settings
  - OpenCodeAdapter.renderMCPServers: JSONC mcp key, local/remote types, {env:VAR} conversion
  - GeminiAdapter.renderMCPServers: JSON mcpServers key (same shape as Claude Code)
  - CodexAdapter.renderMCPServers: TOML mcp_servers, HTTP-only, bearer_token_env_var extraction
  - renderInstructions: base + addendum concatenation (BaseAdapter default, all 4 targets)
  - All RNDR-09 through RNDR-14 requirements satisfied

affects: [02-04, 03-sync-engine]

tech-stack:
  added: []
  patterns:
    - "Claude/Gemini MCP: identical JSON shape with mcpServers key, ${VAR} env placeholders"
    - "OpenCode MCP: JSONC comment-preserving via modifyJsonc, {env:VAR} format conversion"
    - "Codex MCP: TOML HTTP-only with bearer_token_env_var extraction from Authorization header"
    - "Instructions: BaseAdapter default concatenation — no override needed per target"

key-files:
  created:
    - src/adapters/__tests__/mcp-claude-code.test.ts
    - src/adapters/__tests__/mcp-opencode.test.ts
    - src/adapters/__tests__/mcp-gemini.test.ts
    - src/adapters/__tests__/mcp-codex.test.ts
    - src/adapters/__tests__/instructions.test.ts
  modified:
    - src/adapters/claude-code.ts
    - src/adapters/opencode.ts
    - src/adapters/gemini.ts
    - src/adapters/codex.ts

key-decisions:
  - "Gemini MCP is identical to Claude Code — same JSON shape, same ${VAR} env placeholder format"
  - "Codex skips stdio servers entirely — HTTP-only as designed (research + user decision)"
  - "bearer_token_env_var extracted from Authorization header pattern 'Bearer ${VAR}'"
  - "BaseAdapter.renderInstructions default (concatenation + newline) sufficient for all 4 targets — no overrides"
  - "OpenCode modifyJsonc sets mcp={} first to ensure key exists before adding servers"

patterns-established:
  - "Claude/Gemini MCP: parse existing JSON → merge mcpServers → writeJson"
  - "OpenCode MCP: modifyJsonc(['mcp'], {}) to initialize, then modifyJsonc per server"
  - "Codex MCP: filter HTTP-only → build mcp_servers object → writeToml"
  - "Codex returns empty string when no HTTP servers remain (caller decides how to handle)"

requirements-completed: [RNDR-09, RNDR-10, RNDR-11, RNDR-12, RNDR-13, RNDR-14]

duration: 2min
completed: 2026-02-20
---

# Phase 2 Plan 03: MCP Rendering + Instructions Summary

**All 4 adapters fully implemented with renderMCPServers: JSON for Claude/Gemini, JSONC for OpenCode, TOML HTTP-only for Codex — plus instructions concatenation and 64 new tests**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T17:41:46Z
- **Completed:** 2026-02-20T17:44:09Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Claude Code + Gemini: JSON output with `mcpServers` key, merge with existing settings, `${VAR}` env placeholders
- OpenCode: JSONC comment-preserving output with `mcp` key, `local`/`remote` transport types, `{env:VAR}` conversion via EnvVarTransformer
- Codex: TOML `mcp_servers` section, HTTP-only filter, `bearer_token_env_var` extraction from Authorization header
- Instructions rendering: BaseAdapter default (concatenation) works for all 4 targets, no per-target overrides needed
- 64 new tests across 5 files; full suite now 219 tests, 0 failures

## Task Commits

Each task was committed atomically:

1. **Task 1: MCP rendering for Claude Code + OpenCode** - `1d8308f` (feat)
2. **Task 2: MCP rendering for Gemini + Codex, instructions renderer** - `5715e5c` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `src/adapters/claude-code.ts` — Added renderMCPServers: JSON with mcpServers, merge support
- `src/adapters/opencode.ts` — Added renderMCPServers: JSONC with mcp key, EnvVarTransformer conversion
- `src/adapters/gemini.ts` — Added renderMCPServers: identical JSON shape to Claude Code
- `src/adapters/codex.ts` — Added renderMCPServers: TOML HTTP-only with bearer token extraction
- `src/adapters/__tests__/mcp-claude-code.test.ts` — 10 tests for Claude Code MCP rendering
- `src/adapters/__tests__/mcp-opencode.test.ts` — 11 tests for OpenCode MCP rendering
- `src/adapters/__tests__/mcp-gemini.test.ts` — 9 tests for Gemini MCP rendering
- `src/adapters/__tests__/mcp-codex.test.ts` — 11 tests for Codex MCP rendering
- `src/adapters/__tests__/instructions.test.ts` — 23 tests for renderInstructions + expandPaths

## Decisions Made
- Gemini MCP confirmed as identical to Claude Code (JSON `mcpServers`, `${VAR}` format) — per research
- Codex returns empty string when no HTTP servers remain — clean contract, caller decides
- `modifyJsonc(['mcp'], {})` ensures `mcp` key exists before per-server writes (avoids path-not-found)
- BaseAdapter default `renderInstructions` sufficient — no per-target override needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 adapters fully implemented — no stubs remain
- All RNDR-01 through RNDR-14 requirements satisfied
- All 3 SECR requirements satisfied (from Plan 01)
- Phase 2 complete — ready for Phase 3 (sync engine / orchestration)
- 219 tests, 0 failures

## Self-Check: PASSED

- All 9 key files exist on disk ✓
- Task commits 1d8308f and 5715e5c present in git log ✓
- 219 tests pass, 0 fail ✓

---
*Phase: 02-renderers-secrets*
*Completed: 2026-02-20*
