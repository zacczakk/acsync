# Phase 1: Foundation - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Infrastructure layer: deterministic hashing, safe atomic file writes, timestamped backups, format parsers (JSON/JSONC/TOML/Markdown frontmatter), and exclusion filtering. This is the foundation all other phases build on. No rendering, no CLI, no diff engine — just the primitives.

</domain>

<decisions>
## Implementation Decisions

### Error handling contract
- Throw exceptions (not Result types) — callers use try/catch
- All errors wrapped with operation context: file path, operation name, original cause (not raw system errors)
- Custom Error subclasses per operation: `AtomicWriteError`, `HashError`, `BackupError`, `ParseError`
- `ParseError` follows the same custom subclass pattern as infra errors (no special line/col source location needed)

### Hash scope
- File hash: SHA-256 of file content bytes only — permissions and mtime are ignored
- Directory hash: sorted alphabetically by relative path (deterministic across machines/OSes)
- Directory hash includes filenames — renaming a file counts as drift
- Excluded files are skipped entirely from directory hashing (not included at all)

### Backup retention policy
- Backups stored in central directory: `~/Repos/agents/backups/`
- Naming: timestamp-only directory (e.g., `2026-02-20T182618/`), matching existing convention
- Retention: keep last N backups per target (auto-prune oldest when limit exceeded)
- Backup is mandatory before any file write — atomic write enforces backup-first, no skipBackup escape hatch

### Exclusion filter design
- Rules defined in root-level `config.json` (config-driven, not hardcoded)
- Pattern format: glob patterns (e.g., `gsd-*`, `*.bak`)
- `gsd-*` items are managed externally by npx/npm — the sync logic must never read, write, hash, or render them
- Non-canonical files (exist in target dirs but not in canonical source): flag as warning, do not touch
- Format normalization (e.g., `zz/cmd-name` vs `zz-cmd-name`) is a renderer concern, not an exclusion filter concern

### Claude's Discretion
- Exact value of N for backup retention (suggest 5)
- Internal structure of wrapped error context object
- config.json schema for exclusion patterns (key names, nesting)

</decisions>

<specifics>
## Specific Ideas

- `gsd-*` exclusion is non-negotiable: these files are globally managed by npm/npx and the repo must not interfere with them under any circumstances
- Backup location `~/Repos/agents/backups/` with timestamp-only naming already established by the manual sync script — the CLI should match this convention for continuity

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-02-20*
