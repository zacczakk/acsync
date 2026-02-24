# Phase 3: Diff Engine + CLI - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

End-to-end CLI (`acsync`) that diffs canonical configs against rendered targets, pushes changes with atomic writes and rollback on failure, and reports drift with proper exit codes. Includes MCPorter hybrid operational setup (config-level, not code). One-way sync only: canonical → targets.

</domain>

<decisions>
## Implementation Decisions

### Output & reporting
- JSON is the default output format (agents are primary consumers)
- `--pretty` flag adds rich formatted human-readable output (colored headers, grouped sections, counts, summary)
- Diff granularity is file-level only: `{file, status, target, type}` — agents read actual files when they need content
- Exit codes: 0=success, 1=error, 2=drift detected

### Push behavior
- Confirmation prompt by default (safe); `--force` flag skips confirmation (agents use this)
- `--dry-run` previews execution plan without writing
- Rollback on failure is verbose: show each file being restored as it happens, then the error
- Scoped push via `--target` and `--type` flags (singular, repeatable): `--target claude --target codex --type commands`

### CLI invocation design
- Binary name: `acsync`
- Two subcommands: `acsync check` (detect drift) and `acsync push` (sync changes)
- Target identifiers: `claude`, `gemini`, `codex`, `opencode`
- Config type identifiers (plural): `commands`, `agents`, `mcps`, `instructions`, `skills`
- Flags: singular repeatable (`--target claude --target codex`), not comma-separated

### MCPorter hybrid setup
- **Native (rendered by acsync):** context7 (enabled, all CLIs), tavily (enabled, all CLIs)
- **Native but disabled:** sequential-thinking (disabled everywhere)
- **Rendered but disabled + MCPorter:** chrome-devtools, foundry-mcp, liquid-carbon, shadcn — rendered to CLIs but disabled by default; actual usage routed through MCPorter
- `mcporter.json` is managed separately (not by acsync)
- `acsync check` detects MCPorter coverage gaps: warns when a canonical server has no target (not in native rendering or mcporter.json) — warning severity, non-blocking

### Claude's Discretion
- Exact color scheme for `--pretty` output
- Commander.js vs alternatives for CLI framework
- Manifest file location and format
- Rollback implementation details (backup strategy)
- chalk vs picocolors for terminal colors

</decisions>

<specifics>
## Specific Ideas

- Output modeled after `gh pr status` richness level for `--pretty` mode
- Agent-first design: JSON default means agents don't need special flags, humans opt into `--pretty`
- Safety model: preview (`--dry-run`) → confirm → push, or `--force` for automation

</specifics>

<deferred>
## Deferred Ideas

- `pull` subcommand (reading from targets back to canonical) — future phase
- MCPorter config generation by acsync — keep separate for now

</deferred>

---

*Phase: 03-diff-engine-cli*
*Context gathered: 2026-02-20*
