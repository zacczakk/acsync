# Requirements: Agent Config Sync CLI

**Defined:** 2026-02-20
**Core Value:** Make config sync fast and cheap by moving mechanical transforms into deterministic code

**Design Principle:** Minimal CLI. Script the obvious (renderers, hashes, diffs, copies). Leave complex/judgmental logic to agents.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Rendering

- [x] **RNDR-01**: Render canonical command → Claude Code format (strip `zz-` prefix, nest in `zz/` subdir, body verbatim)
- [x] **RNDR-02**: Render canonical command → OpenCode format (rebuild frontmatter, `allowed-tools` → `tools` map, keep `zz-` prefix)
- [x] **RNDR-03**: Render canonical command → Gemini format (convert to TOML, `prompt = """..."""`)
- [x] **RNDR-04**: Render canonical command → Codex format (flat markdown, `# /{name}` heading + description)
- [x] **RNDR-05**: Render canonical agent → Claude Code format (nest in `zz/` subdir, body verbatim)
- [x] **RNDR-06**: Render canonical agent → OpenCode format (rebuild frontmatter, add `mode: subagent`)
- [x] **RNDR-07**: Render canonical agent → Gemini format (add `kind: local` to frontmatter)
- [x] **RNDR-08**: Render canonical agent → Codex format (flat markdown, `# Agent: {name}` heading)
- [x] **RNDR-09**: Render canonical MCP server → Claude Code format (JSON, `mcpServers` key, inject secrets)
- [x] **RNDR-10**: Render canonical MCP server → OpenCode format (JSONC, `mcp` key, `local`/`remote` types, `environment` key, command as array)
- [x] **RNDR-11**: Render canonical MCP server → Gemini format (JSON, `mcpServers` key, inject secrets)
- [x] **RNDR-12**: Render canonical MCP server → Codex format (TOML, `mcp_servers` key, HTTP-only, skip stdio servers)
- [x] **RNDR-13**: Render instructions per CLI (concatenate AGENTS.md + CLI-specific addendum)
- [x] **RNDR-14**: Copy skill directories verbatim (directory copy with support files)

### Diff Engine

- [x] **DIFF-01**: Compute SHA-256 content hash for any file or directory
- [x] **DIFF-02**: Read/write manifest file (JSON, tracks last-synced hashes per target)
- [x] **DIFF-03**: Compare source vs target vs manifest to produce operations (create/update/skip)
- [x] **DIFF-04**: Output diff as structured JSON (for agent consumption)
- [x] **DIFF-05**: Output diff as human-readable colored text (for terminal)

### Secret Handling

- [x] **SECR-01**: Load secrets from `.env` file
- [x] **SECR-02**: Inject secrets into rendered configs on push (replace `${VAR}` placeholders with values)
- [x] **SECR-03**: Convert env var syntax per target (`${VAR}` ↔ `${env:VAR}` ↔ `{env:VAR}`)

### File Operations

- [x] **FILE-01**: Atomic write (write to temp, fsync, rename)
- [x] **FILE-02**: Backup target file before overwrite (timestamped copy)
- [x] **FILE-03**: Dry-run mode (compute diff, show plan, write nothing)
- [x] **FILE-04**: Rollback on push failure (track written files, restore all to pre-push state on first error; replaces Phase 1 backup-only approach)

### CLI Interface

- [x] **CLI-01**: `render` subcommand — render a canonical config to a specific target format, output to stdout or file
- [x] **CLI-02**: `diff` subcommand — show what would change for one or all targets
- [x] **CLI-03**: `push` subcommand — render + write to target locations
- [x] **CLI-04**: `check` subcommand — diff-only, exit non-zero if drift detected
- [x] **CLI-05**: `--json` flag on all subcommands for structured output
- [x] **CLI-06**: `--dry-run` flag on push (compute + display, no writes)
- [x] **CLI-07**: `--target` flag to scope to specific CLI (e.g., `--target claude`)
- [x] **CLI-08**: `--type` flag to scope to config type (e.g., `--type commands`, `--type mcp`)
- [x] **CLI-09**: Exit codes: 0=success, 1=error, 2=drift-detected

### Exclusions

- [x] **EXCL-01**: Skip `gsd-*` files and directories during sync
- [x] **EXCL-02**: Skip non-canonical items in targets (don't delete, don't touch)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Settings Merge

- **SETM-01**: Deep merge Claude Code settings (permissions array merge, env wholesale replace)
- **SETM-02**: Deep merge OpenCode settings (provider/plugin/model wholesale, permission deep-merge)
- **SETM-03**: Deep merge Gemini settings (mcpServers only)

### Pull Direction

- **PULL-01**: Read target configs and reverse-transform to canonical format
- **PULL-02**: Detect drift: compare target state to what CLI last pushed
- **PULL-03**: Present drift to agent for interactive resolution

### Advanced

- **ADV-01**: Import from target (one-time bootstrap from existing CLI config to canonical)
- **ADV-02**: Path expansion (`~` → absolute) in rendered configs
- **ADV-03**: Post-write secret scan (paranoid check that no secrets leaked to git-tracked files)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Settings deep merge in CLI | Too many per-key edge cases; agent handles this better with context |
| Non-canonical item preservation logic | Requires judgment about what to keep; agent decides |
| Interactive confirmation UI | Agent provides the UX; CLI is headless |
| Template language | TypeScript functions are the "templates"; no DSL needed |
| Watch mode / auto-sync | Premature; sync is infrequent |
| Plugin system | 4 fixed targets; add as code when needed |
| Bidirectional merge resolution | Source of truth is canonical repo; no merge conflicts |
| Password manager integration | `.env` file covers our needs |
| Symlink mode | Copies are more reliable; symlinks break when repo moves |
| Multi-language CLI output | English only; developer tool |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DIFF-01 | Phase 1 | Complete |
| FILE-01 | Phase 1 | Complete |
| FILE-02 | Phase 1 | Complete |
| EXCL-01 | Phase 1 | Complete |
| EXCL-02 | Phase 1 | Complete |
| RNDR-01 | Phase 2 | Complete |
| RNDR-02 | Phase 2 | Complete |
| RNDR-03 | Phase 2 | Complete |
| RNDR-04 | Phase 2 | Complete |
| RNDR-05 | Phase 2 | Complete |
| RNDR-06 | Phase 2 | Complete |
| RNDR-07 | Phase 2 | Complete |
| RNDR-08 | Phase 2 | Complete |
| RNDR-09 | Phase 2 | Complete |
| RNDR-10 | Phase 2 | Complete |
| RNDR-11 | Phase 2 | Complete |
| RNDR-12 | Phase 2 | Complete |
| RNDR-13 | Phase 2 | Complete |
| RNDR-14 | Phase 2 | Complete |
| SECR-01 | Phase 2 | Complete |
| SECR-02 | Phase 2 | Complete |
| SECR-03 | Phase 2 | Complete |
| DIFF-02 | Phase 3 | Complete |
| DIFF-03 | Phase 3 | Complete |
| DIFF-04 | Phase 3 | Complete |
| DIFF-05 | Phase 3 | Complete |
| FILE-03 | Phase 3 | Complete |
| FILE-04 | Phase 3 | Complete |
| CLI-01 | Phase 3 | Complete |
| CLI-02 | Phase 3 | Complete |
| CLI-03 | Phase 3 | Complete |
| CLI-04 | Phase 3 | Complete |
| CLI-05 | Phase 3 | Complete |
| CLI-06 | Phase 3 | Complete |
| CLI-07 | Phase 3 | Complete |
| CLI-08 | Phase 3 | Complete |
| CLI-09 | Phase 3 | Complete |

**Coverage:**
- v1 requirements: 37 total
- Mapped to phases: 37 ✓
- Unmapped: 0

---
*Requirements defined: 2026-02-20*
*Last updated: 2026-02-20 after roadmap phase mapping*
