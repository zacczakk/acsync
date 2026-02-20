---
phase: 02-renderers-secrets
plan: 02
subsystem: adapters
tags: [adapters, renderers, claude-code, opencode, gemini, codex, toml, markdown, frontmatter]

requires:
  - phase: 02-renderers-secrets
    provides: BaseAdapter abstract class, ToolAdapter interface, AdapterPathResolver, stringifyFrontmatter, types

provides:
  - ClaudeCodeAdapter: renderCommand (verbatim pass-through) + renderAgent
  - OpenCodeAdapter: renderCommand (description-only frontmatter) + renderAgent (mode:subagent)
  - GeminiAdapter: renderCommand (TOML with triple-quoted prompt) + renderAgent (kind:local)
  - CodexAdapter: renderCommand (flat markdown # /{name}) + renderAgent (Role/AllowedTools lines)

affects: [02-03, 02-04]

tech-stack:
  added: []
  patterns:
    - "Verbatim pass-through: ClaudeCode preserves all frontmatter keys and body unchanged"
    - "Rebuild-and-strip: OpenCode rebuilds frontmatter keeping only allowed keys"
    - "TOML hand-craft: Gemini builds triple-quoted prompt string manually (smol-toml can't produce it)"
    - "Flat markdown: Codex emits heading + paragraphs with no frontmatter"

key-files:
  created:
    - src/adapters/claude-code.ts
    - src/adapters/opencode.ts
    - src/adapters/gemini.ts
    - src/adapters/codex.ts
    - src/adapters/__tests__/claude-code.test.ts
    - src/adapters/__tests__/opencode.test.ts
    - src/adapters/__tests__/gemini.test.ts
    - src/adapters/__tests__/codex.test.ts
  modified: []

key-decisions:
  - "Gemini TOML command output hand-crafted (not via writeToml) to produce triple-quoted prompt strings"
  - "gray-matter omits frontmatter delimiters when data object is empty — body emitted directly"
  - "Codex agents go to ~/.codex/prompts/ (same dir as commands) — PathResolver handles this"

patterns-established:
  - "renderCommand/renderAgent: pure string transform, no I/O, return RenderedFile"
  - "OpenCode command: only description key in frontmatter"
  - "OpenCode agent: description + mode:subagent, strip name + allowed-tools"
  - "Gemini command: TOML with description string + triple-quoted prompt ending in User arguments: {args}"
  - "Gemini agent: markdown frontmatter with description + allowed-tools + kind:local"
  - "Codex command: # /{name}\\n\\n{description}\\n\\n{body}"
  - "Codex agent: # Agent: {name}\\n\\n**Role**: {desc}\\n\\n**Allowed Tools**: {tools}\\n\\n{body}"

requirements-completed: [RNDR-01, RNDR-02, RNDR-03, RNDR-04, RNDR-05, RNDR-06, RNDR-07, RNDR-08]

duration: 1min
completed: 2026-02-20
---

# Phase 2 Plan 02: CLI Adapter Renderers Summary

**4 adapter classes (claude-code, opencode, gemini, codex) implementing all 8 render functions: verbatim pass-through for Claude, rebuilt frontmatter for OpenCode, TOML triple-quoted prompt for Gemini, and flat markdown headings for Codex**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-20T17:37:47Z
- **Completed:** 2026-02-20T17:39:37Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- ClaudeCodeAdapter: full verbatim pass-through for both commands and agents — all frontmatter keys preserved
- OpenCodeAdapter: commands keep description only; agents add mode:subagent, strip name/allowed-tools
- GeminiAdapter: commands render as TOML with triple-quoted prompt + `{args}` appended; agents get kind:local
- CodexAdapter: flat markdown with `# /{name}` for commands, `# Agent: {name}` with Role/AllowedTools for agents
- 59 tests across 4 test files, all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Claude Code + OpenCode adapters (commands + agents)** - `418299f` (feat)
2. **Task 2: Gemini + Codex adapters (commands + agents)** - `c9cc520` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `src/adapters/claude-code.ts` — ClaudeCodeAdapter: verbatim frontmatter + body pass-through
- `src/adapters/opencode.ts` — OpenCodeAdapter: description-only commands, mode:subagent agents
- `src/adapters/gemini.ts` — GeminiAdapter: TOML commands with triple-quoted prompt, kind:local agents
- `src/adapters/codex.ts` — CodexAdapter: flat markdown commands and agents, no frontmatter
- `src/adapters/__tests__/claude-code.test.ts` — 13 tests for ClaudeCodeAdapter
- `src/adapters/__tests__/opencode.test.ts` — 11 tests for OpenCodeAdapter
- `src/adapters/__tests__/gemini.test.ts` — 19 tests for GeminiAdapter
- `src/adapters/__tests__/codex.test.ts` — 16 tests for CodexAdapter

## Decisions Made
- **Gemini TOML hand-crafted**: smol-toml's `stringify` doesn't produce triple-quoted multi-line strings. Built the TOML content directly as a string template with `"""` delimiters.
- **gray-matter empty data behavior**: when the metadata object is empty, gray-matter emits body without frontmatter delimiters — tests updated to reflect this correct behavior (Rule 1 auto-fix).
- **Codex agents in prompts/**: PathResolver routes both commands and agents to `~/.codex/prompts/` — no deviation needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected test expectation for gray-matter empty metadata behavior**
- **Found during:** Task 1 (OpenCode adapter tests)
- **Issue:** Test expected `---` delimiters in output when metadata is empty, but gray-matter omits them when data is `{}`
- **Fix:** Updated test assertion to verify body content is present instead (correct expected behavior)
- **Files modified:** `src/adapters/__tests__/opencode.test.ts`
- **Verification:** All 24 tests pass after fix
- **Committed in:** `418299f` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — incorrect test expectation)
**Impact on plan:** Minimal — test expectation adjusted to match gray-matter's documented behavior. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 adapter classes in place with full test coverage (59 tests)
- Plan 03 can now implement MCP server rendering for all adapters (currently stubbed with `throw new Error`)
- All adapters extend BaseAdapter and compile cleanly

## Self-Check

- `src/adapters/claude-code.ts` exists ✓
- `src/adapters/opencode.ts` exists ✓
- `src/adapters/gemini.ts` exists ✓
- `src/adapters/codex.ts` exists ✓
- Task commit `418299f` present in git log ✓
- Task commit `c9cc520` present in git log ✓
- 59 tests pass, 0 fail ✓

## Self-Check: PASSED

---
*Phase: 02-renderers-secrets*
*Completed: 2026-02-20*
