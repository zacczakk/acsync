# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** Make config sync fast and cheap by moving mechanical transforms into deterministic code
**Current focus:** Phase 4 — CLI subcommands test fixes (gap closure)

## Current Position

Phase: 4 of 4 (CLI Subcommands Test Fixes)
Plan: 2 of 2 in current phase
Status: Complete
Last activity: 2026-02-21 — Completed 04-02-PLAN.md (test fixes: rollback collision + skills host dependency)

Progress: [██████████] 100% (All 4 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 12
- Average duration: 5min
- Total execution time: ~0.8 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 | 14min | 7min |
| 02-renderers-secrets | 3 | 5min | 1.7min |
| 03-diff-engine-cli | 5 | 33min | 6.6min |
| 04-cli-subcommands-test-fixes | 2 | ~8min | 4min |

**Recent Trend:**
- Last 5 plans: 2min, 3min, 10min, 5min, 4min
- Trend: stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Ported vsync ErrorSeverity/SyncError pattern with operation+path context
- hashFile uses raw bytes — diverges from vsync's model-level hashing
- atomicWrite ported from vsync with backup-first addition
- Format parsers are pure string-in/string-out (no file I/O)
- JSONC comment preservation via jsonc-parser modify+applyEdits
- smol-toml over @iarna/toml (TOML 1.1, smaller)
- Missing .env warns and continues (does not throw)
- EnvVarTransformer normalizes through claude-code format as intermediate
- codex env var format: strips ${} wrapper to bare var name
- gemini format identical to claude-code (${VAR})
- AdapterPathResolver fully expands ~ at construction time
- Claude command naming: strip zz- prefix, nest under zz/ subdir
- Gemini TOML hand-crafted for triple-quoted prompt strings (smol-toml can't produce them)
- gray-matter omits frontmatter delimiters when data object is empty
- Codex commands and agents both go to ~/.codex/prompts/ directory
- Gemini MCP identical to Claude Code (JSON mcpServers, ${VAR} format)
- Codex MCP TOML HTTP-only with bearer_token_env_var extraction
- OpenCode MCP uses modifyJsonc for comment preservation + {env:VAR} conversion
- Manifest path: .acsync/manifest.json in project root (simpler than vsync's ~/.vsync/cache/<hash>/)
- No delete operation type — safe mode only per EXCL-02
- saveManifest uses .acsync/backups as backupDir to satisfy atomicWrite signature
- picocolors over chalk — lighter, no dependencies
- restoreAll processes in reverse order — last written restored first
- getPaths() added to BaseAdapter (needed for orchestrator path resolution)
- Orchestrator hashes rendered content (not source files) for diff comparison
- Per-test unique salts in integration tests (push writes to real filesystem)
- [Phase 03-diff-engine-cli]: Claude commands go to ~/.claude/commands/{name}.md — no zz/ nesting, no prefix logic
- [Phase 03-diff-engine-cli]: Stale deletion opt-in via --delete flag; omitting skips deletes (safe default)
- [Phase 03-diff-engine-cli]: Write ${VAR} placeholders as-is; no injectSecrets in runPush — each CLI reads env vars natively; manifest hashes match on-disk hashes
- [Phase 04-cli-subcommands-test-fixes]: Module-level counter for collision-safe backup filenames
- [Phase 04-cli-subcommands-test-fixes]: Adapter tests use temp fixtures via getPaths() override, not host filesystem

### Pending Todos

None yet.

### Blockers/Concerns

- Research flags Phase 2 (Codex adapter) as least battle-tested — validate during implementation
- TOML comment preservation not supported by any JS library — current approach (generate from scratch) is fine for v1

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 04-02-PLAN.md. All phases + gap closure complete. 435/435 tests pass.
Resume file: None
