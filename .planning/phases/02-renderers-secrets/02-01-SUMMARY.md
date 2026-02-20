---
phase: 02-renderers-secrets
plan: 01
subsystem: secrets
tags: [secrets, env-loader, injector, env-var-transformer, adapters, path-resolver, types]

requires: []
provides:
  - secrets module: loadSecrets, injectSecrets, redactSecrets, EnvVarTransformer
  - adapter base: ToolAdapter interface, BaseAdapter abstract class
  - AdapterPathResolver: all 4 target CLI paths fully expanded
  - types: TargetName, CanonicalItem, MCPServer, RenderedFile, AdapterCapabilities, SupportFile
affects: [02-02, 02-03, 02-04]

tech-stack:
  added: []
  patterns:
    - "Warn-don't-throw: missing .env returns empty secrets + warning instead of throwing"
    - "Normalize-then-convert: EnvVarTransformer normalizes through claude-code as intermediate"
    - "Sort-by-length for redaction: avoids partial-match replacement issues"
    - "Fully-expanded paths: no ~ in output, all paths write-ready"
    - "Abstract render-only BaseAdapter: no I/O, returns strings for caller to write"

key-files:
  created:
    - src/secrets/env-loader.ts
    - src/secrets/injector.ts
    - src/secrets/env-var-transformer.ts
    - src/secrets/__tests__/env-loader.test.ts
    - src/secrets/__tests__/injector.test.ts
    - src/secrets/__tests__/env-var-transformer.test.ts
    - src/adapters/base.ts
    - src/adapters/path-resolver.ts
  modified:
    - src/types.ts
    - src/errors.ts

key-decisions:
  - "Missing .env warns and continues (does not throw) — caller decides how to handle"
  - "EnvVarTransformer normalizes through claude-code format as intermediate"
  - "codex format strips ${} wrapper to bare var name"
  - "gemini format is identical to claude-code (${VAR})"
  - "AdapterPathResolver fully expands ~ at construction time"
  - "Claude command naming: strip zz- prefix, nest under zz/ subdir"
  - "Gemini commands use .toml extension, others use .md"

patterns-established:
  - "Secrets module: warn-don't-throw for missing env file and unresolved vars"
  - "Redaction: sort-by-length descending to avoid partial replacements"
  - "EnvVarTransformer: static class methods, recursive object/array handling"
  - "BaseAdapter: abstract with no I/O — subclasses render, caller writes"

requirements-completed: [SECR-01, SECR-02, SECR-03]

duration: 2min
completed: 2026-02-20
---

# Phase 2 Plan 01: Secret Handling Infrastructure + Adapter Base Classes Summary

**Secrets module (loadSecrets, injectSecrets, redactSecrets, EnvVarTransformer) + BaseAdapter/ToolAdapter hierarchy + AdapterPathResolver for all 4 target CLIs**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T17:33:05Z
- **Completed:** 2026-02-20T17:35:35Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Secrets module with .env parsing, placeholder injection, redaction, and multi-format env var conversion
- ToolAdapter interface + BaseAdapter abstract class establishing render contract for Plan 02
- AdapterPathResolver with all target-specific paths (commands, agents, MCP, instructions, skills) fully expanded
- Extended types.ts with CanonicalItem, MCPServer, RenderedFile, AdapterCapabilities, TargetName
- SecretError added to errors.ts following existing pattern
- 32 tests across 3 files, all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, secrets module (env-loader + injector + EnvVarTransformer)** - `5c90a91` (feat)
2. **Task 2: BaseAdapter, ToolAdapter interface, and PathResolver** - `f1f29e1` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `src/types.ts` — Added TargetName, CanonicalItem, MCPServer, RenderedFile, AdapterCapabilities, SupportFile
- `src/errors.ts` — Added SecretError class
- `src/secrets/env-loader.ts` — loadSecrets: parses .env files, warns on missing
- `src/secrets/injector.ts` — injectSecrets + redactSecrets
- `src/secrets/env-var-transformer.ts` — EnvVarTransformer: claude-code/opencode/gemini/codex conversions
- `src/secrets/__tests__/env-loader.test.ts` — 9 tests for env-loader
- `src/secrets/__tests__/injector.test.ts` — 11 tests for injector + redactor
- `src/secrets/__tests__/env-var-transformer.test.ts` — 12 tests for transformer
- `src/adapters/path-resolver.ts` — AdapterPathResolver for all 4 target CLIs
- `src/adapters/base.ts` — ToolAdapter interface + BaseAdapter abstract class

## Decisions Made
- Missing .env warns and continues (does not throw) — consistent with plan's "warn, don't throw" decision
- EnvVarTransformer normalizes through claude-code format as intermediate
- codex format: strips `${}` wrapper to return bare var name (array-friendly)
- gemini format is identical to claude-code (`${VAR}`)
- All paths fully expanded (no ~ in output) — write-ready

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Secrets infrastructure and adapter base classes are in place
- Plan 02 can now implement concrete adapters (ClaudeCodeAdapter, OpenCodeAdapter, GeminiAdapter, CodexAdapter)
- All 4 renderers will extend BaseAdapter and use AdapterPathResolver for path construction

## Self-Check: PASSED

- All 8 key source files exist on disk ✓
- Task commits 5c90a91 and f1f29e1 present in git log ✓
- 32 tests pass (0 fail) ✓

---
*Phase: 02-renderers-secrets*
*Completed: 2026-02-20*
