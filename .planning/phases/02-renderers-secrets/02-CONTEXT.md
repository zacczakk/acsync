# Phase 2: Renderers + Secrets - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Lightweight rendering — pure functions that transform canonical configs to 4 target CLI formats (Claude Code, OpenCode, Gemini, Codex), plus secret loading/injection from `.env`. Borrows heavily from vsync (`~/Repos/oss/vsync/cli/src/`). Does NOT include diff engine, CLI shell, or manifest tracking (Phase 3).

</domain>

<decisions>
## Implementation Decisions

### vsync borrowing boundaries
- Adopt vsync's normalized interchange models directly: `BaseItem` (name, content, metadata, hash, supportFiles) and `MCPServer` (type, command, args, url, env, auth)
- Port `EnvVarTransformer` as a class (not flattened to functions) — keep vsync's instance method pattern (toOpenCode(), toClaude(), normalize())
- Port adapter classes from vsync — bring over the BaseAdapter/ToolAdapter class hierarchy, not just extracted transform functions
- Include `PathResolver` (centralized path construction) and `AdapterCapabilities` (per-target feature matrix)
- Exclude: AdapterRegistry (plugin system), rollback, parallel sync, i18n — none needed for 4 fixed targets
- General principle: port vsync's proven logic; do NOT re-derive what vsync already solved

### Secret handling behavior
- Missing `.env` file: warn and leave `${VAR}` placeholders intact in rendered output
- Missing individual variable in `.env`: warn per variable, leave that placeholder unresolved
- `.env` location: canonical repo root only (`~/Repos/agents/.env`) — no CWD search, no `--env` flag
- Redaction in output: secret values shown as `****` in dry-run/diff output (not placeholder names, not raw values)

### Renderer function signatures
- Adapters receive parsed canonical objects (typed), not raw file paths — caller handles file I/O
- Adapter write methods return rendered string content — caller handles atomic write + backup via Phase 1 infra
- MCP renderer takes full server list and produces complete settings file (not one server at a time)
- Path expansion (`~/` -> absolute) happens inside the renderer — output is write-ready, no post-processing
- Instructions renderer concatenates AGENTS.md + CLI-specific addendum with path expansion applied

### Codex adapter gaps
- Implement ALL Codex renderers (commands, agents, MCP) — full coverage across all 4 targets, no gaps
- Codex command/agent formats: trust prior patterns from sync script (flat markdown, `# /name` heading). No re-verification needed
- Codex MCP: port vsync's TOML serialization as-is (env_vars array, bearer_token_env_var, HTTP-only with stdio skip)

### Claude's Discretion
- Exact adapter class structure (how much of BaseAdapter to port vs simplify)
- Test strategy for renderers (snapshot tests, assertion-based, or both)
- File organization within `src/` (adapters/, renderers/, etc.)
- How to handle edge cases in frontmatter round-tripping

</decisions>

<specifics>
## Specific Ideas

- vsync reference codebase at `~/Repos/oss/vsync/cli/src/` — key files:
  - `adapters/base.ts` — BaseAdapter + ToolAdapter interface
  - `adapters/claude-code.ts`, `opencode.ts`, `codex.ts` — per-target serialization
  - `utils/env-var-transformer.ts` — normalize-then-convert env var pattern
  - `utils/mcp-utils.ts` — MCP type inference + field population
  - `types/models.ts` — BaseItem + MCPServer interchange models
- Phase 1 infra already in place: atomicWrite, backup, hash, format parsers (JSON, JSONC, TOML, markdown frontmatter)
- JSONC-preserving edits via `jsonc-parser` already used in Phase 1 — continue that pattern for OpenCode configs

</specifics>

<deferred>
## Deferred Ideas

- **MCPorter**: Full MCP management tool — render all MCP servers to all CLIs, distinguish high-freq vs low-freq MCPs, low-freq disabled by default and surfaced via MCPorter CLI. Read `MCPORTER_ANALYSIS.md` for design context. This is a separate initiative that layers on top of Phase 2's rendering. MUST be built — do not forget.
- **Rollback**: Port vsync's rollback infrastructure for Phase 3 push command (tracks written files, reverts on failure).

</deferred>

---

*Phase: 02-renderers-secrets*
*Context gathered: 2026-02-20*
