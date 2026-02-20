# Feature Research

**Domain:** Config sync CLI for AI coding tools
**Researched:** 2026-02-20
**Confidence:** HIGH

## Competitive Landscape

Six tools analyzed across two categories:

**AI coding tool config sync (direct competitor):**
- **vsync** (nicepkg/vsync) — one-command sync for Claude Code, Cursor, OpenCode, Codex. JSON/JSONC/TOML conversion, env var syntax rewriting, atomic writes, hash-based manifest, safe/prune modes, diff planning. 612 tests. v1.2 current.

**General dotfile managers (design inspiration):**
- **chezmoi** — gold standard. Templates (Go), 15+ password manager integrations, encryption (age/gpg), partial file management via modify templates, format conversion functions (fromJson/toToml/etc), diff/merge, scripts, machine-to-machine differences.
- **yadm** — git-based, Jinja templates, alternative files, GPG encryption. Simpler than chezmoi.
- **stow** — GNU symlink farm manager. Zero transform capability. Simple.
- **dotbot** — YAML config, symlink-based. No templates, no secrets, no partial files.
- **mackup** — cloud storage sync (Dropbox/iCloud). Application presets. No format conversion.

## Feature Landscape

### Table Stakes (Users Expect These)

Features every config sync tool must have. Missing = tool is useless.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Format conversion** (JSON/JSONC/TOML) | Each AI tool uses different formats; manual conversion is the core pain | MEDIUM | vsync, chezmoi both do this. Must handle JSONC comments, TOML arrays-of-tables, JSON trailing commas. Markdown frontmatter is unique to us |
| **Diff/preview before apply** | Users must see what changes before committing. chezmoi `diff`, vsync `plan` | LOW | Show create/update/delete with colored output. vsync's diff planning is the baseline |
| **Dry-run mode** | Safety net. Every config tool has this | LOW | `--dry-run` flag. Pure subset of diff/preview |
| **Atomic writes** | Partial writes corrupt configs, breaking AI tools mid-session | MEDIUM | Write to temp file, fsync, rename. vsync does this. chezmoi does this |
| **Hash-based change detection** | Skip unchanged files; know when drift occurs | LOW | Content hash (SHA-256) stored in manifest. vsync uses this for its manifest system |
| **Single source of truth** | Canonical repo is the authority; targets derive from it | LOW | Architectural decision, not a feature per se. vsync and chezmoi both enforce this |
| **Safe mode (no destructive default)** | Accidentally deleting user customizations is catastrophic | LOW | Default: create + update only. Require explicit flag for deletes. vsync's safe/prune split is correct |
| **Env var syntax conversion** | `${VAR}` vs `${env:VAR}` vs `{env:VAR}` — each tool differs | MEDIUM | vsync handles this. Must be bidirectional and never expand actual values |
| **Backup before overwrite** | Recovery path when sync goes wrong | LOW | Timestamped backup dir before first write. chezmoi doesn't do this; vsync doesn't either. We already do this in our agent-driven flow and it's proven valuable |
| **CLI with clear exit codes** | Scriptable; CI integration; agent consumption | LOW | 0=success, 1=error, 2=drift-detected (for check mode). Standard practice |

### Differentiators (Competitive Advantage)

Features that set us apart from vsync. This is where we win.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Secret injection from .env** | vsync only converts env var syntax but never injects values. We inject secrets at write time and mask on read-back. Enables checked-in canonical configs with `{env:SECRET}` placeholders resolved per-machine | MEDIUM | chezmoi does this via password manager templates. We do it simpler: `.env` file + placeholder syntax. No external password manager needed |
| **Non-canonical item preservation** | vsync is all-or-nothing (safe=keep extras, prune=delete extras). We deep-merge: sync managed keys while preserving user-added keys in target files. Critical for settings files where users add custom permissions, model overrides, etc | HIGH | This is our hardest feature and biggest differentiator. Requires per-format parser that understands merge semantics. Our agent-driven sync already does this (Claude kept user-added `Read()` permission) |
| **Markdown frontmatter transformation** | No other tool handles this. Our commands/agents use markdown with YAML/TOML frontmatter that differs per CLI target. OpenCode uses TOML frontmatter with different key names (`allowed-tools` -> `tools` map) | HIGH | Unique to AI coding tool configs. Must parse frontmatter, transform keys, rebuild. No competitor handles this |
| **Per-target transform pipelines** | vsync has hardcoded format mappings. We need composable transforms: parse -> remap keys -> convert env syntax -> inject secrets -> serialize. Different pipeline per target CLI | MEDIUM | Code-as-transform (TypeScript functions) instead of template language. More testable, more debuggable than chezmoi's Go templates |
| **Agent-friendly structured output** | AI agents consume our tool's output. Must be parseable: JSON output mode, structured diff report, clear success/failure with file-level detail | LOW | vsync and chezmoi output for humans. We output for both humans and agents. `--json` flag on all commands |
| **Deterministic transforms (no templates)** | chezmoi uses Go templates; vsync uses hardcoded mappings. We use TypeScript transform functions — testable, type-safe, debuggable. Same input always produces same output | LOW | Architectural choice. Transform functions are unit-testable. Template languages hide bugs |
| **Subset sync (scope control)** | Sync only commands, or only MCP, or only settings. Fine-grained control over what gets synced | LOW | vsync has `sync_config` flags (skills/mcp/agents/commands). We need the same but with per-file granularity |
| **Drift detection (`check` mode)** | Exit non-zero when targets don't match expected state. CI-friendly. No writes, just comparison | LOW | `sync --check` or `check` subcommand. vsync has `status` but doesn't exit non-zero. Critical for CI gates |
| **Path expansion** | `~` -> absolute paths. Canonical configs use `~`; rendered configs need absolute paths per machine | LOW | We already do this in agent-driven sync. Simple but important for cross-machine correctness |

### Anti-Features (Commonly Requested, Often Problematic)

Features to explicitly NOT build.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Template language** | chezmoi's Go templates are powerful; seems like the "right" approach | Adds a DSL users must learn. Hides logic in string interpolation. Hard to test, hard to debug. Our transforms are TypeScript — already a language users know | Write transform functions in TypeScript. Unit-testable, type-safe, IDE support |
| **Bidirectional sync** | "What if I edit in a target tool?" | Merge conflicts become intractable. Source-of-truth principle breaks. vsync explicitly rejects this. chezmoi is source->target only | Edit in source, sync out. Import command for one-time pulls from targets |
| **Plugin system** | Extensibility for custom formats/targets | Premature abstraction. We have 4 known targets with known formats. Plugin API is a maintenance burden with near-zero users | Hardcode target definitions. Add new targets as PRs. Revisit if >8 targets |
| **Watch mode (file watcher)** | Auto-sync on save | Race conditions, partial writes, unexpected syncs. Adds daemon complexity. vsync has this on roadmap (v1.3) but hasn't shipped | Manual `sync` command. CI hook for automated flows |
| **GUI / web dashboard** | Visual config management | Scope creep. CLI tool should stay CLI. vsync has this on v2.0 roadmap — a warning sign | Terminal UI (optional) for interactive diff review. Not a priority |
| **Password manager integration** | chezmoi supports 15+ password managers | Massive surface area. Our use case is `.env` files on local machines, not enterprise secret management | `.env` file injection covers 95% of cases. Document how to pipe from `op`/`bw` into `.env` |
| **Encryption at rest** | chezmoi supports age/gpg encryption of source files | Our canonical repo is private. Secrets live in `.env` (gitignored). Encryption adds key management complexity | Keep secrets out of repo. `.env` + `.gitignore` |
| **Symlink mode** | vsync supports symlinks as alternative to copying | Symlinks break when canonical repo moves. Different tools handle symlinked configs differently. Copies are more reliable | Always copy. Atomic write-to-temp + rename |
| **Multi-language CLI output** | vsync supports English + Chinese | Internationalization adds translation maintenance burden for a developer tool | English only. Developer tools are English-first |

## Feature Dependencies

```
Format Conversion (JSON/JSONC/TOML/Markdown)
    +-- Env Var Syntax Conversion (needs format parser)
    +-- Secret Injection (needs format parser + .env loader)
    +-- Non-Canonical Item Preservation (needs format parser + deep merge)
    +-- Per-Target Transform Pipeline (orchestrates all above)

Hash-Based Change Detection
    +-- Drift Detection / Check Mode (compare hashes)
    +-- Diff/Preview (show what changed)

Atomic Writes
    +-- Backup Before Overwrite (backup dir before atomic write batch)

CLI Framework
    +-- Dry-Run Mode (flag)
    +-- Agent-Friendly Output (--json flag)
    +-- Subset Sync (scope flags)
```

### Dependency Notes

- **Format conversion is foundational:** Every differentiator depends on parsing/serializing config formats. Build this first, test exhaustively.
- **Non-canonical preservation requires deep merge:** Most complex feature. Depends on format parsers producing structured data (not just string transforms).
- **Hash detection is independent of format conversion:** Can be built in parallel. Just content hashing + manifest storage.
- **Secret injection depends on format conversion + .env loading:** Two independent pieces that compose. `.env` loader is trivial; integration with format pipeline is the work.
- **Drift detection is hash detection + CLI exit codes:** Nearly free once hashing exists.

## MVP Definition

### Launch With (v1)

Minimum viable: replace the 777-line agent-driven sync with deterministic code.

- [ ] **Format conversion** (JSON/JSONC/TOML/Markdown frontmatter) — core value; without this, tool doesn't work
- [ ] **Per-target transform pipelines** — the orchestration layer that composes parsers + transforms
- [ ] **Non-canonical item preservation** (deep merge) — critical differentiator; without this, users lose customizations
- [ ] **Env var syntax conversion** — table stakes; every target uses different syntax
- [ ] **Hash-based change detection** — skip unchanged files; enable drift detection
- [ ] **Atomic writes with backup** — safety guarantee
- [ ] **Diff/preview + dry-run** — user trust
- [ ] **Secret injection from .env** — enables checked-in configs with placeholder secrets
- [ ] **CLI with exit codes + --json output** — scriptable, agent-friendly

### Add After Validation (v1.x)

Features to add once core sync is proven reliable.

- [ ] **Drift detection CI command** (`check` subcommand) — trigger: when users want CI gates
- [ ] **Subset sync** (per-resource-type scope) — trigger: when users want to sync only commands or only MCP
- [ ] **Path expansion** (`~` -> absolute) — trigger: when cross-machine use cases arise
- [ ] **Import from target** (one-time pull) — trigger: when users need to bootstrap canonical from existing target

### Future Consideration (v2+)

- [ ] **Interactive TUI diff reviewer** — why defer: nice UX but not essential; CLI diff is sufficient
- [ ] **Config validation** (schema-based) — why defer: useful but configs are diverse; hard to generalize schemas
- [ ] **Team sharing / config registry** — why defer: single-user tool first, team features add auth/storage complexity

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Format conversion (JSON/JSONC/TOML/MD) | HIGH | MEDIUM | P1 |
| Per-target transform pipelines | HIGH | MEDIUM | P1 |
| Non-canonical item preservation | HIGH | HIGH | P1 |
| Env var syntax conversion | HIGH | LOW | P1 |
| Hash-based change detection | HIGH | LOW | P1 |
| Atomic writes + backup | HIGH | LOW | P1 |
| Diff/preview + dry-run | HIGH | LOW | P1 |
| Secret injection from .env | MEDIUM | MEDIUM | P1 |
| CLI + exit codes + --json | MEDIUM | LOW | P1 |
| Drift detection (check mode) | MEDIUM | LOW | P2 |
| Subset sync (scope control) | MEDIUM | LOW | P2 |
| Path expansion | LOW | LOW | P2 |
| Import from target | LOW | MEDIUM | P3 |
| Interactive TUI diff | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch (replaces agent-driven sync)
- P2: Should have, add when possible (CI integration, convenience)
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | vsync | chezmoi | yadm | Our Approach |
|---------|-------|---------|------|--------------|
| Format conversion | JSON/JSONC/TOML | Via template functions | N/A | JSON/JSONC/TOML/Markdown frontmatter |
| Secret management | Env var syntax only (no injection) | 15+ password managers via templates | GPG encryption | .env injection + placeholder syntax |
| Partial file management | No (whole-file only) | modify templates (Go) | Alternative files | Deep merge with non-canonical preservation |
| Diff/preview | Yes (plan command) | Yes (diff command) | Yes (via git) | Yes + --json for agent consumption |
| Atomic writes | Yes (fsync) | Yes | No (git-based) | Yes (temp + rename) |
| Change detection | Hash manifest | Source state attributes | Git status | Content hash manifest |
| Non-canonical preservation | No (safe=keep all, prune=delete all) | modify templates (manual) | N/A | Automatic deep merge preserving unmanaged keys |
| Transform approach | Hardcoded mappings | Go template language | Jinja templates | TypeScript functions (testable, typed) |
| Agent-friendly output | No (human-only) | No (human-only) | No | Yes (--json on all commands) |
| Targets | Claude Code, Cursor, OpenCode, Codex | Any dotfile | Any dotfile | Claude Code, Cursor, OpenCode, Codex (same as vsync) |
| Env var conversion | `${VAR}` <-> `${env:VAR}` <-> `{env:VAR}` | Via templates | N/A | Same conversions + secret injection |
| Settings deep merge | No | No | No | Yes (preserve user additions in target settings files) |
| Markdown frontmatter | No | No | No | Yes (YAML/TOML frontmatter with key remapping) |

### vsync Gap Analysis (Direct Competitor)

vsync solves 70% of the same problem. Gaps that justify building our own:

1. **No non-canonical item preservation** — vsync's safe mode keeps everything in targets (including stale items); prune mode deletes everything not in source. Neither preserves user-added items while updating managed items. This is our #1 differentiator.
2. **No secret injection** — vsync converts env var syntax between tools but never injects actual values. We need secrets from `.env` injected into rendered configs.
3. **No markdown frontmatter** — our commands/agents use markdown files with CLI-specific frontmatter. vsync only handles MCP config files (JSON/JSONC/TOML).
4. **No settings deep merge** — vsync syncs skills/MCP/agents/commands but not settings files (the ones with user model overrides, permissions, etc). These require deep merge semantics.
5. **No agent-friendly output** — vsync outputs for human consumption. Our tool is consumed by AI agents as part of larger workflows.
6. **Hardcoded transform logic** — vsync's format conversion is internal. Our transforms need to be composable, testable functions with per-target pipelines.

## Sources

- vsync (nicepkg/vsync): https://github.com/nicepkg/vsync — direct competitor, v1.2, 612 tests, MIT. HIGH confidence.
- chezmoi: https://chezmoi.io/comparison-table/ — feature comparison across dotfile managers. HIGH confidence (official docs via Context7).
- chezmoi modify templates: https://www.chezmoi.io/user-guide/manage-different-types-of-file — partial file management, setValueAtPath for JSON/TOML/YAML. HIGH confidence.
- chezmoi secret management: https://www.chezmoi.io/user-guide/password-managers/ — 15+ password manager integrations. HIGH confidence.
- dotbot: https://github.com/anishathalye/dotbot — minimal, symlink-based. MEDIUM confidence (GitHub README).
- stow: GNU Stow — symlink farm, no transforms. HIGH confidence (well-known tool).
- yadm: https://yadm.io/ — git-based, Jinja templates, GPG. MEDIUM confidence.
- mackup: https://pypi.org/project/mackup/ — cloud storage sync, application presets. MEDIUM confidence.

---
*Feature research for: Config sync CLI for AI coding tools*
*Researched: 2026-02-20*
