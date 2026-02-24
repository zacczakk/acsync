# Phase 6: Flatten Canonical Structure - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove the `configs/common/` intermediate directory. All canonical configs (`agents/`, `commands/`, `mcp/`, `settings/`, `skills/`, `instructions/`) move directly under `configs/`. All code, tests, docs, and error messages update to reference `configs/` instead of `configs/common/`. No new capabilities — purely structural.

</domain>

<decisions>
## Implementation Decisions

### Migration strategy
- Plain mv + fresh commit (no `git mv` — don't need blame preservation)
- Single atomic commit: move files AND update all references in one commit
- Delete `configs/common/` immediately in same commit — no leftover empty directory
- Check git state (clean working tree) before making changes, but no special-case handling for `configs/common/`

### Backward compatibility
- Hard break — no symlink from old path to new
- Update ALL docs (AGENTS.md, inline comments, help text) in the same atomic commit
- CLI `--help` output should explicitly show the canonical path: "Manages canonical configs in configs/ and syncs them to 4 CLI targets"
- No "did you mean?" migration hints — overkill for single-user tool

### Path constant design
- Define a single constant for the canonical root in an existing shared module (not a new file)
- Also define subpath constants: `COMMANDS_DIR`, `AGENTS_DIR`, `MCP_DIR`, etc. — no string concatenation scattered around
- Paths resolve to absolute at definition time (when the module loads)
- All call sites import from this one location

### Error & help text
- Error messages show absolute paths when a canonical file isn't found
- No special migration hints for old `configs/common/` references
- CLI description updated to say `configs/` (not `configs/common/`)
- Test assertions should be path-agnostic (check that errors are thrown, not exact path strings) — more resilient to future changes

### Claude's Discretion
- Whether to add `.gitkeep` in any `configs/` subdirectories (only if a dir would otherwise be empty)
- Which existing module to place the path constants in (types file, config file, etc.)
- Exact wording of updated error messages and help text

</decisions>

<specifics>
## Specific Ideas

- "Check other uncommitted changes and sanitize the .git state before moving things around" — user wants clean git state verified as a pre-step, not just for `configs/common/` but generally
- Path constants should be the single source of truth — if the path changes again (e.g., Phase 8 repo rename), only one place to update

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-flatten-canonical-structure*
*Context gathered: 2026-02-24*
