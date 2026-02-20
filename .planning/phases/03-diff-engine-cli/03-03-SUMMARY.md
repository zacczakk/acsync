---
phase: 03-diff-engine-cli
plan: 03
subsystem: mcp, cli
tags: [mcporter, mcp, enabled, e2e, tavily, sequential-thinking]

# Dependency graph
requires:
  - phase: 03-diff-engine-cli
    plan: 02
    provides: runCheck, runPush, acsync CLI, orchestrator
  - phase: 02-renderers-secrets
    provides: adapter renderMCPServers, AdapterPathResolver
provides:
  - Tavily enabled for all CLIs (removed disabled_for)
  - MCPServer.enabled field — render but mark disabled in targets that support it
  - getRenderedServerNames() on adapters — orchestrator uses adapter's own filter logic
  - OpenCode renders enabled:false servers with native disabled flag
  - Claude/Gemini/Codex exclude enabled:false servers (no native disabled mechanism)
  - Cleaned up sequential-thinking.json (removed redundant disabled_for)
  - MCPorter docs in AGENTS.md
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "enabled:false = target-dependent: OpenCode renders with disabled flag, others exclude"
    - "getRenderedServerNames() — adapter declares which servers it will render, orchestrator defers to it"
    - "disabledFor excludes per-target; enabled:false is global disable with per-target semantics"

key-files:
  modified:
    - src/types.ts
    - src/adapters/base.ts
    - src/adapters/claude-code.ts
    - src/adapters/opencode.ts
    - src/adapters/gemini.ts
    - src/adapters/codex.ts
    - src/cli/orchestrator.ts
    - configs/common/mcp/tavily.json
    - configs/common/mcp/sequential-thinking.json
    - src/adapters/__tests__/mcp-claude-code.test.ts
    - src/adapters/__tests__/mcp-opencode.test.ts
    - src/adapters/__tests__/mcp-gemini.test.ts
    - src/adapters/__tests__/mcp-codex.test.ts

key-decisions:
  - "enabled:false for OpenCode uses native 'enabled: false' field (confirmed from real config)"
  - "Claude/Gemini/Codex have no native disabled mechanism — exclude enabled:false servers entirely"
  - "getRenderedServerNames() added to ToolAdapter interface — each adapter declares its own filter"
  - "Codex overrides getRenderedServerNames() to also filter by transport=http"
  - "Removed disabled_for from tavily.json — Tavily now rendered for all CLIs"
  - "Removed disabled_for from sequential-thinking.json — redundant (stdio + enabled:false)"
  - "Secret injection causes perpetual drift for Claude/Gemini — known limitation, not in scope"

patterns-established:
  - "Adapter declares rendered server names; orchestrator defers to adapter for diff display"

requirements-completed: [DIFF-02, DIFF-03]

# Metrics
duration: 15min
completed: 2026-02-20
---

# Phase 03 Plan 03: MCPorter Hybrid + enabled:false + E2E Summary

**Trimmed canonical MCP to 3 servers, added enabled:false support for target-dependent disabled rendering, enabled Tavily for all CLIs, and verified E2E pipeline**

## Performance

- **Duration:** 15 min (across 2 sessions)
- **Started:** 2026-02-20
- **Completed:** 2026-02-20
- **Tasks:** 2 (Task 1 in prior session, Task 2 + enabled:false in this session)
- **Files modified:** 13

## Accomplishments

### From prior session (Task 1)
- Trimmed canonical MCP to 3 servers (trashed chrome-devtools, palantir, liquid-carbon, shadcn)
- Updated AGENTS.md with MCPorter tool docs
- Updated CLI addendums for MCPorter references

### This session (Task 2 + enabled:false)
- Removed `disabled_for` from tavily.json — Tavily now enabled for all CLIs
- Added `enabled?: boolean` to MCPServer type
- Added `getRenderedServerNames()` to ToolAdapter interface + BaseAdapter default
- OpenCode adapter: renders enabled:false servers with native `"enabled": false` flag
- Claude/Gemini/Codex adapters: exclude enabled:false servers (no native disabled)
- Codex adapter: overrides getRenderedServerNames() for transport+disabled+disabledFor filtering
- Orchestrator: uses adapter.getRenderedServerNames() instead of its own filter
- Cleaned up sequential-thinking.json (removed redundant disabled_for)
- 12 new tests across 4 MCP adapter test files
- E2E verified: push MCP → check shows 0 drift for OpenCode/Codex

## Task Commits

1. **Task 1:** `140cbe5` — Trim canonical MCP, update docs
2. **enabled:false support:** `4f97fa3` — Type, adapters, orchestrator, tests
3. **Prior fixes in this phase:** Display names, dry-run, MCP paths (see 03-03 commit history)

## E2E Verification Results

| Target | MCP Servers Rendered | Status After Push |
|--------|---------------------|-------------------|
| OpenCode | context7, tavily, sequential-thinking(disabled) | Clean (0 drift) |
| Codex | context7 | Clean (0 drift) |
| Claude | context7, tavily | Drift (secret injection) |
| Gemini | context7, tavily | Drift (secret injection) |

**Known limitation:** Claude/Gemini show perpetual MCP drift because secret injection replaces `${VAR}` placeholders with real values during push, but check compares rendered (placeholders) vs on-disk (real values). Not in scope for v1.

## Known Issues

1. **Secret injection drift** — Check always detects MCP drift for Claude/Gemini after push (placeholder vs injected value mismatch)
2. **OpenCode HTTP headers not rendered** — context7 canonical has headers, OpenCode adapter doesn't render them for remote type. Pre-existing gap.
3. **Rollback test flaky** — `restoreAll > processes backups in reverse order` fails on timestamp collision. Pre-existing.

---
*Phase: 03-diff-engine-cli*
*Completed: 2026-02-20*
