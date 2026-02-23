# Requirements: acsync

**Defined:** 2026-02-20
**Core Value:** Make config sync fast and cheap by moving mechanical transforms into deterministic code

## v1 Requirements (Complete)

All 37 v1 requirements satisfied. See MILESTONES.md for details.

## v2.0 Requirements

Requirements for Simplify Canonical milestone. Flatten structure, unify instructions, rename repo.

### Canonical Structure

- [ ] **STRUCT-01**: `configs/common/` directory flattened — all subdirs (agents, commands, mcp, settings, skills, instructions) live directly under `configs/`
- [ ] **STRUCT-02**: All source code path references updated from `configs/common/X` to `configs/X`
- [ ] **STRUCT-03**: All test fixtures and assertions updated for new path structure
- [ ] **STRUCT-04**: Help text and error messages reference `configs/` (not `configs/common/`)
- [ ] **STRUCT-05**: `configs/common/` directory no longer exists

### Instructions Unification

- [ ] **INST-01**: AGENTS.md lives at `configs/instructions/AGENTS.md` (moved from repo root)
- [ ] **INST-02**: No AGENTS.md at repo root
- [ ] **INST-03**: AGENTS.md contains `## CLI-Specific Notes` section with merged content from all 4 per-CLI addendums
- [ ] **INST-04**: Per-CLI addendum files deleted (claude.md, opencode.md, gemini.md, codex.md)
- [ ] **INST-05**: `renderInstructions()` accepts single content parameter (no addendum)
- [ ] **INST-06**: `readCanonicalInstructions()` reads single file from `configs/instructions/AGENTS.md`
- [ ] **INST-07**: OpenCode instructions output file is `AGENTS.md` (not `OPENCODE.md`)
- [ ] **INST-08**: Gemini instructions output file is `AGENTS.md` (not `GEMINI.md`)
- [ ] **INST-09**: Codex instructions output file is `AGENTS.md` (not `instructions.md`)
- [ ] **INST-10**: Claude instructions output file remains `CLAUDE.md` (unchanged)

### TOOLS.md

- [ ] **TOOL-01**: `configs/instructions/TOOLS.md` exists with tool-use documentation
- [ ] **TOOL-02**: AGENTS.md `## Tools` section references TOOLS.md by absolute path
- [ ] **TOOL-03**: TOOLS.md is not rendered/synced to any CLI target (reference only)

### Repo Identity

- [ ] **REPO-01**: Repo folder renamed from `~/Repos/agents` to `~/Repos/acsync`
- [ ] **REPO-02**: All internal path references updated (`~/Repos/agents` -> `~/Repos/acsync`)
- [ ] **REPO-03**: `acsync` binary re-registered via `bun link` from new location
- [ ] **REPO-04**: `acsync push --force` propagates all path changes to targets
- [ ] **REPO-05**: OpenCode `opencode.json` instructions array points to `AGENTS.md` (not `OPENCODE.md`)
- [ ] **REPO-06**: Stale target files cleaned up: `~/.config/opencode/OPENCODE.md`, `~/.gemini/GEMINI.md`, `~/.codex/instructions.md`

## Future Requirements (v2.1 — vsync-alignment)

- **HASH-01**: Metadata-aware hashing for canonical items
- **DIFF-01**: True 3-way diff using manifest hash (6-case algorithm)
- **DIFF-02**: Prune/delete mode integrated into diff engine
- **CAP-01**: Capability enforcement in adapters (throw on unsupported operations)
- **ERR-01**: Error type guards and static factory methods
- **CODEX-01**: Codex agents rendered as TOML (not markdown in prompts/)
- **CODEX-02**: Codex agent entries in config.toml `[agents]` section
- **MCP-01**: Dedicated MCP server hash with sorted keys

## Out of Scope

| Feature | Reason |
|---------|--------|
| TOOLS.md rendering to targets | Referenced by absolute path; all agents have repo access |
| Watch mode / auto-sync | Premature; sync is infrequent |
| Bidirectional merge conflict resolution | Source of truth is canonical repo |
| vsync pattern adoption | Deferred to v2.1 milestone |
| Codex TOML agent format | Deferred to v2.1 milestone |
| Plugin system | 4 fixed targets; add as code when needed |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STRUCT-01 | TBD | Pending |
| STRUCT-02 | TBD | Pending |
| STRUCT-03 | TBD | Pending |
| STRUCT-04 | TBD | Pending |
| STRUCT-05 | TBD | Pending |
| INST-01 | TBD | Pending |
| INST-02 | TBD | Pending |
| INST-03 | TBD | Pending |
| INST-04 | TBD | Pending |
| INST-05 | TBD | Pending |
| INST-06 | TBD | Pending |
| INST-07 | TBD | Pending |
| INST-08 | TBD | Pending |
| INST-09 | TBD | Pending |
| INST-10 | TBD | Pending |
| TOOL-01 | TBD | Pending |
| TOOL-02 | TBD | Pending |
| TOOL-03 | TBD | Pending |
| REPO-01 | TBD | Pending |
| REPO-02 | TBD | Pending |
| REPO-03 | TBD | Pending |
| REPO-04 | TBD | Pending |
| REPO-05 | TBD | Pending |
| REPO-06 | TBD | Pending |

**Coverage:**
- v2.0 requirements: 24 total
- Mapped to phases: 0
- Unmapped: 24

---
*Requirements defined: 2026-02-23*
*Last updated: 2026-02-23 after v2.0 initial definition*
