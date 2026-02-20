# Pitfalls Research

**Domain:** Config sync CLI tool (dotfile management across 4 AI coding CLIs)
**Researched:** 2026-02-20
**Confidence:** HIGH (derived from SYNC.md battle-tested edge cases, vsync source analysis, and domain research)

## Critical Pitfalls

### Pitfall 1: JSONC Comment Destruction on Round-Trip

**What goes wrong:**
Parsing JSONC (JSON with comments) via `JSON.parse()` silently strips all comments. Writing back via `JSON.stringify()` produces valid JSON but destroys user annotations. OpenCode's `opencode.json` may have JSONC variants (`opencode.jsonc`). Claude's `.claude.json` might accumulate user comments in editors that tolerate them.

**Why it happens:**
Standard `JSON.parse` doesn't preserve comments. Developers reach for it by default. The bug is invisible until a user notices their annotations vanished after a sync push.

**How to avoid:**
Use `jsonc-parser` (the VS Code library) for all JSON/JSONC operations. vsync already does this — its `writeJSONC()` accepts `existingText` and applies targeted edits via `jsonc.modify()` + `jsonc.applyEdits()`, preserving comments and formatting. Never `JSON.parse()` → mutate → `JSON.stringify()` for files users edit manually.

**Warning signs:**
- Any import of `JSON.parse` for user-facing config files
- Test files that don't include comments in fixture data
- User reports of "my comments disappeared"

**Phase to address:**
Phase 1 (core file I/O layer). The JSONC-aware read/write must be the only path from day one.

---

### Pitfall 2: Deep Merge Clobbers Arrays Instead of Merging Them

**What goes wrong:**
Claude `settings.json` has `permissions.allow` and `permissions.deny` arrays. A naive deep merge replaces the entire array with canonical values, destroying user-added entries (e.g., machine-local `Read(/Users/.../articles/**)` rules). lodash `_.merge` merges arrays by index position, which is equally wrong — it overwrites `array[0]` with `canonical[0]`.

**Why it happens:**
Deep merge semantics for arrays are inherently ambiguous. Libraries (lodash, deepmerge, structuredClone) each handle arrays differently. No single default is correct for all use cases. SYNC.md explicitly documents that `permissions` requires deep-merge with "canonical wins on conflict, user extras preserved."

**How to avoid:**
Implement merge strategies per-key, not a single global deep merge. For array fields:
- `permissions.allow`: union merge (deduplicate by value, canonical wins on conflict)
- `permissions.deny`: union merge (same)
- `instructions` (OpenCode): wholesale replace (it's a simple string array)

Mark each managed key's merge strategy in a schema declaration, not buried in merge logic. Test with fixtures containing user-added entries.

**Warning signs:**
- Using a single `deepMerge()` call for the entire settings object
- No test cases with user-added array entries
- "Merge succeeded" but user entries missing after sync

**Phase to address:**
Phase 2 (subset merge engine). This is the core differentiator over a naive copy tool.

---

### Pitfall 3: Secret Value Leaked to Git via Incomplete Redaction

**What goes wrong:**
During pull (system → repo), real secret values in system files must be redacted back to `${VAR}` placeholders before writing to canonical files. Missing a single code path (e.g., a new MCP server, the `FOUNDRY_TOKEN` alias, or `UPTIMIZE_BEDROCK_API_KEY` in nested provider config) means a real API key gets committed.

**Why it happens:**
Redaction is a string replacement operation that must cover every location where secrets appear, including:
- `env` blocks in MCP configs (4 different formats)
- `headers` blocks in HTTP MCP configs
- Nested paths like `provider.uptimize-bedrock.options.apiKey`
- The `FOUNDRY_TOKEN` alias (env key differs from `.env` variable name)

One missed substitution = leaked secret.

**How to avoid:**
1. After every pull operation, scan the entire output for exact string matches of all known secret values. Fail loudly if any are found.
2. Implement redaction as a final pass over serialized content, not per-field replacement.
3. Add a pre-commit hook (or post-pull verification) that greps canonical files for known secret patterns.
4. The `FOUNDRY_TOKEN` ↔ `PALANTIR_FOUNDRY_TOKEN` alias must be a first-class mapping, not an afterthought.

**Warning signs:**
- Redaction logic that operates field-by-field instead of a final content scan
- No test for the `FOUNDRY_TOKEN` alias round-trip
- No integration test that verifies "zero secrets in output files"

**Phase to address:**
Phase 1 (secret handling module). Must be correct from the first push/pull. Add a paranoid verification step that runs after every write.

---

### Pitfall 4: OpenCode `{env:VAR}` Confused with Secret Placeholder `${VAR}`

**What goes wrong:**
OpenCode provider configs use `{env:ANTHROPIC_BASE_URL}` — runtime env var references that OpenCode resolves at startup. These look similar to `${PALANTIR_FOUNDRY_TOKEN}` (secret placeholders that our sync tool resolves). A naive regex replacing `$?{env:...}` or `${...}` patterns will corrupt OpenCode provider configs by injecting secret values where runtime references belong, or vice versa.

**Why it happens:**
Three different env var syntaxes exist across the CLIs:
- `${VAR}` — canonical/Claude secret placeholder
- `{env:VAR}` — OpenCode runtime reference (no dollar sign)
- `${env:VAR}` — Cursor-style (not our concern, but vsync handles it)

The regex patterns for these overlap. vsync's `EnvVarTransformer` handles this with explicit format-aware transformation. Our tool must never touch `{env:VAR}` patterns during secret injection.

**How to avoid:**
1. Secret injection regex must match `${VAR}` exactly (dollar + curly brace + uppercase + curly brace).
2. Explicitly skip patterns matching `{env:VAR}` (no dollar sign).
3. Test fixture: OpenCode settings with both `{env:ANTHROPIC_BASE_URL}` and `${UPTIMIZE_BEDROCK_API_KEY}` — verify only the latter gets injected.

**Warning signs:**
- A single regex handles all env var patterns
- No test distinguishing `{env:X}` from `${X}`
- OpenCode stops working after sync (broken provider config)

**Phase to address:**
Phase 1 (secret handling module). Critical for OpenCode push correctness.

---

### Pitfall 5: Partial Write Leaves CLI in Broken State

**What goes wrong:**
A sync push writes multiple files per CLI (commands, agents, MCP, settings). If the process crashes mid-operation (Ctrl+C, disk full, permission denied on one file), the CLI ends up with a mix of old and new configs. For example, updated MCP server definitions but old agent files that reference servers differently.

**Why it happens:**
File writes are not transactional. Each `writeFile` is independent. Without explicit ordering and rollback, partial completion is the default failure mode.

**How to avoid:**
1. Use atomic writes (temp file + rename) for every file — vsync's pattern: write to `.tmp-{random}`, fsync, rename. This prevents corruption of individual files.
2. Implement per-CLI rollback: backup all target files before writing, restore on failure. vsync has a `rollback.ts` module for this.
3. Write order matters: settings/MCP first (most likely to fail on permissions), then commands/agents (less critical).
4. On macOS: ensure temp files are in the same filesystem as the target (rename across filesystems is not atomic).

**Warning signs:**
- `writeFile` calls without a temp-file+rename wrapper
- No backup before multi-file writes
- No error handling that rolls back completed writes on failure

**Phase to address:**
Phase 1 (core file I/O layer). Atomic write + backup must be foundational.

---

### Pitfall 6: macOS `/var` vs `/private/var` Symlink Inconsistency

**What goes wrong:**
On macOS, `/var` is a symlink to `/private/var`, `/tmp` to `/private/tmp`, etc. `path.resolve()` returns the logical path, but `fs.realpath()` returns the physical path. Manifest hashes, cache directories, and path comparisons produce different results depending on which path form is used. This causes phantom "drift detected" on every check.

**Why it happens:**
macOS's firmlink/symlink indirection is invisible to most code. `process.cwd()` may return either form depending on how the shell navigated there. vsync explicitly calls `realpathSync()` in `getProjectCacheDir()` to normalize this.

**How to avoid:**
Normalize all paths through `fs.realpath()` before hashing or comparing. Apply this at the boundary (path input), not scattered through the codebase. Use a single `normalizePath()` utility.

**Warning signs:**
- Manifest reports "changed" files that haven't actually changed
- Different hash for same directory depending on how it's accessed
- Tests pass in CI (Linux) but fail on macOS dev machines

**Phase to address:**
Phase 1 (core path utilities). Must be correct before manifests are implemented.

---

### Pitfall 7: TOML Serialization Loses Type Fidelity

**What goes wrong:**
TOML has strict typing: integers, floats, booleans, strings, datetimes are distinct. When round-tripping through JavaScript, `toml.parse()` → JS object → `toml.stringify()` can lose type information. A TOML integer `port = 443` might become `port = 443.0` if JavaScript treats it as a float. Inline tables `{key = "value"}` may expand to separate sections. String escaping (backslashes in Gemini command prompts) may double-escape.

**Why it happens:**
JavaScript has a single `number` type. TOML distinguishes integer from float. The `@iarna/toml` library preserves this during parse→stringify, but intermediate JavaScript manipulation (spreading, cloning) drops the type metadata.

**How to avoid:**
1. For Codex `config.toml`: use string manipulation for the `[mcp_servers.*]` section append — don't parse and re-serialize the entire file. This preserves user formatting and avoids type coercion of non-MCP sections.
2. For Gemini TOML commands: escape backslashes explicitly before wrapping in triple-quoted strings.
3. Test round-trip: parse → stringify → parse again. Diff must be empty.

**Warning signs:**
- Full-file TOML parse+serialize when only appending MCP sections
- No test for backslash escaping in Gemini command prompts
- Codex `config.toml` user settings (model, providers) get reformatted after sync

**Phase to address:**
Phase 2 (CLI-specific renderers). Gemini TOML commands and Codex config.toml both need this.

---

### Pitfall 8: Exclusion Rule Drift Destroys Non-Canonical Items

**What goes wrong:**
Claude has `ralph-tui-*` skills that must survive sync. GSD files (`gsd-*`, `.sync-manifest.json`, `.gsd-file-manifest.json`) must never be touched. If exclusion rules are incomplete, hardcoded, or applied inconsistently between push/pull/check, a sync wipe deletes user-managed items.

**Why it happens:**
Exclusion rules are essentially a "negative filter" that must be applied in every code path that lists, writes, or deletes files. Missing it in one adapter means the next sync deletes the item.

**How to avoid:**
1. Single source of truth for exclusion patterns — one function, imported everywhere.
2. Exclusions operate on the listing step (never see excluded items), not the write step (see but skip).
3. Test: populate target directory with excluded items, run full sync, verify they survive.
4. Make exclusion patterns configurable (new non-canonical items may appear).

**Warning signs:**
- Exclusion logic duplicated across adapters
- `readdir` calls without exclusion filtering
- No test that verifies excluded items survive a full sync cycle

**Phase to address:**
Phase 1 (core exclusion filter). Must be in place before any directory-level sync operations.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single `JSON.parse/stringify` for all JSON files | Simpler code | Destroys JSONC comments, loses formatting | Never — use jsonc-parser from start |
| Global deep merge for settings | One merge call | Clobbers arrays, corrupts per-key merge semantics | Never — per-key strategy required |
| String-template secret injection | Fast to implement | Misses nested paths, aliases, format conflicts | Never — use value-scanning approach |
| Full TOML parse/serialize for partial updates | Clean code | Reformats user content, type coercion | MVP only — switch to targeted append by Phase 2 |
| Inline exclusion checks per adapter | Works for 1-2 CLIs | Exclusion drift as adapters multiply | Never — centralize from start |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude Code `~/.claude.json` | Overwriting `projects`, `enabledMcpjsonServers` | Subset merge: only touch `mcpServers` key |
| OpenCode `opencode.json` | Treating `provider.*.options.apiKey` same as `{env:VAR}` | Different handling: secret injection vs. leave-as-is |
| Gemini TOML commands | Forgetting `\` → `\\` escaping in triple-quoted strings | Explicit backslash escape pass before TOML serialization |
| Codex `config.toml` | Parsing entire file to update MCP sections | String-level append/replace of `[mcp_servers.*]` sections |
| Codex prompts directory | Writing command files and agent files to same dir without collision | Agents use `agent-{name}.md` prefix convention |
| Claude Code permissions | `JSON.parse` → `JSON.stringify` for deep merge | Use `jsonc-parser` modify/applyEdits for surgical updates |
| Claude Code `settings.json` hooks | Overwriting GSD-managed `hooks` and `statusLine` | Explicit unmanaged-key list; never touch them |
| Path expansion `~` → `$HOME` | Hardcoding `/Users/` or `/home/` | Use `os.homedir()` for expand, regex for collapse |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Reading every file to compute diff | Slow check on repos with many commands/agents | Hash manifest: compare hashes before reading content | >50 managed files |
| Re-parsing `.env` per file write | Negligible now, messy later | Parse `.env` once at startup, pass values through | Not a perf issue, but a correctness issue (stale reads) |
| Full TOML re-serialize on append | Codex config gets reformatted | String-level section management | Any Codex config with custom user formatting |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Secret values in error messages / logs | API keys in terminal output or log files | Redact secrets from all error/debug output; never interpolate secret values into log strings |
| `.env` committed to repo | All secrets exposed in git history | `.gitignore` entry + pre-commit hook; verify on every pull operation |
| Secret scan only on known fields | New MCP server with secrets in unexpected field goes unredacted | Post-write content scan: grep for all known secret values in all output files |
| Backup files contain secrets | Backup dir (`backups/<timestamp>/`) has plaintext secrets | Exclude backup dir from git; or redact secrets in backups too |
| `FOUNDRY_TOKEN` alias missed in redaction | `PALANTIR_FOUNDRY_TOKEN` value committed under `FOUNDRY_TOKEN` key | First-class alias mapping: env key → secret name → `.env` variable |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent overwrites (no diff shown) | User loses custom config without warning | Always show diff before write; require explicit confirmation |
| "0 changes" when changes exist (hash bug) | False confidence that configs are in sync | Verify hash computation with round-trip tests; show file-level diffs on `check` |
| Cryptic error on missing `.env` | User doesn't know which secrets are needed | List all required variables with descriptions; offer `.env.example` template |
| No dry-run mode | Can't preview what sync will do without risk | `--dry-run` flag from Phase 1; default for first sync |
| Per-file confirmation fatigue (17 commands × 4 CLIs = 68 prompts) | User approves blindly after file #5 | Batch confirmation per CLI per category; `--yes` flag for automation |

## "Looks Done But Isn't" Checklist

- [ ] **Secret injection:** Test the `FOUNDRY_TOKEN` alias specifically — the env key name differs from the `.env` variable name
- [ ] **OpenCode env syntax:** Verify `{env:ANTHROPIC_BASE_URL}` survives push untouched (no dollar sign added)
- [ ] **Codex HTTP-only filter:** Verify all stdio MCP servers are silently skipped (not errored)
- [ ] **Claude nested commands:** Verify `zz/gate.md` maps to `/zz:gate` invocation (not `/zz/gate`)
- [ ] **Gemini agent frontmatter:** Verify `kind: local` is added (not just copied verbatim)
- [ ] **Exclusion filter:** Run full sync with `ralph-tui-*` skills present — verify they survive
- [ ] **GSD exclusion:** Run full sync with `gsd-*` files present — verify they're untouched
- [ ] **Path expansion:** Test with `~` in canonical and `$HOME` in system — verify round-trip
- [ ] **Instruction concatenation:** Verify two newlines separate `AGENTS.md` from CLI addendum
- [ ] **Instruction pull split:** Verify the header marker split (`# Claude Code Addendum`) works for each CLI
- [ ] **Array merge:** Push with user-added permission entries, pull back, verify they survive
- [ ] **TOML backslash:** Gemini command with `\n` in body — verify it becomes `\\n` in TOML
- [ ] **Atomic write:** Kill process mid-sync — verify no half-written files exist
- [ ] **Backup creation:** Verify backups are created before first write, not after

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Secret leaked to git | HIGH | Rotate all leaked keys immediately; `git filter-branch` or BFG to remove from history; force-push (coordinate with team) |
| JSONC comments destroyed | LOW | Restore from backup; re-add comments manually; fix parser to use jsonc-parser |
| Array merge clobber | LOW | Restore from backup; re-run sync with correct merge strategy |
| Partial write / broken CLI | MEDIUM | Restore from per-CLI backup; if no backup, re-run push from scratch |
| Exclusion filter miss (non-canonical items deleted) | MEDIUM | Restore from backup; may need to re-install skills/plugins manually |
| TOML type coercion | LOW | Restore from backup; switch to string-level append instead of full serialize |
| Manifest corruption | LOW | Delete manifest file; next sync does a full diff (slower but self-healing) |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| JSONC comment destruction | Phase 1: Core I/O | Round-trip test: parse → modify → serialize preserves comments |
| Deep merge array clobber | Phase 2: Subset merge | Test: user-added permission entries survive push cycle |
| Secret leak via incomplete redaction | Phase 1: Secret module | Post-write scan: grep all output files for known secret values |
| `{env:VAR}` vs `${VAR}` confusion | Phase 1: Secret module | Test: OpenCode push preserves `{env:}` while injecting `${}` secrets |
| Partial write / broken state | Phase 1: Atomic write | Kill-test: interrupt mid-sync, verify no half-written files |
| macOS `/var` vs `/private/var` | Phase 1: Path utilities | Test: hash of `/var/...` equals hash of `/private/var/...` |
| TOML type coercion | Phase 2: CLI renderers | Round-trip test: Codex config.toml unchanged after push with no diff |
| Exclusion rule drift | Phase 1: Exclusion filter | Test: non-canonical items survive full sync cycle |
| Instruction split on pull | Phase 2: Pull direction | Test: split at `# Claude Code Addendum` marker yields correct halves |
| Codex HTTP-only filter | Phase 2: CLI renderers | Test: stdio MCP servers produce zero output for Codex adapter |

## Sources

- `~/Repos/agents/SYNC.md` — 777-line battle-tested playbook documenting all edge cases (HIGH confidence)
- vsync source code (`~/Repos/oss/vsync/cli/src/`) — atomic writes, manifest management, env var transformation, JSONC/TOML handling (HIGH confidence)
- lodash/lodash#5089 — array merge semantics are a known source of bugs (HIGH confidence)
- chezmoi design FAQ (chezmoi.io) — template-based dotfile management approach; secret handling via password managers (MEDIUM confidence)
- GitHub community discussion on secret detection pre-commit hooks (MEDIUM confidence)
- AGENTS.md sync learnings (2026-02-18) — first-hand experience with format transformations and edge cases (HIGH confidence)

---
*Pitfalls research for: config sync CLI tool*
*Researched: 2026-02-20*
