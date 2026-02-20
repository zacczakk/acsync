# Phase 1: Foundation - Research

**Researched:** 2026-02-20
**Domain:** Deterministic hashing, atomic file I/O, backup, format parsers, exclusion filtering
**Confidence:** HIGH

## Summary

Phase 1 builds the infrastructure primitives that all subsequent phases depend on: SHA-256 content hashing (files and directories), crash-safe atomic file writes, timestamped backups with retention, format parsers (JSON, JSONC, TOML, Markdown frontmatter), and config-driven exclusion filtering. All of these are well-understood problems with mature, verified solutions in the Bun/TypeScript ecosystem.

The key insight is that Bun provides most infrastructure natively (`Bun.CryptoHasher`, `Bun.file()`, `Bun.write()`, `Bun.Glob`, native `.env` loading), so the dependency surface is small. Only three external libraries are needed for format parsing: `jsonc-parser` (JSONC with comment preservation), `smol-toml` (TOML parse/stringify), and `gray-matter` (Markdown frontmatter round-trip). Atomic writes and backup are hand-rolled using POSIX primitives — no library needed.

**Primary recommendation:** Build five focused modules (`hash.ts`, `atomic-write.ts`, `backup.ts`, `formats/*.ts`, `exclusion.ts`) with custom error subclasses, verified by round-trip tests for each format and kill-safety tests for atomic writes.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Error handling contract:**
- Throw exceptions (not Result types) — callers use try/catch
- All errors wrapped with operation context: file path, operation name, original cause (not raw system errors)
- Custom Error subclasses per operation: `AtomicWriteError`, `HashError`, `BackupError`, `ParseError`
- `ParseError` follows the same custom subclass pattern as infra errors (no special line/col source location needed)

**Hash scope:**
- File hash: SHA-256 of file content bytes only — permissions and mtime are ignored
- Directory hash: sorted alphabetically by relative path (deterministic across machines/OSes)
- Directory hash includes filenames — renaming a file counts as drift
- Excluded files are skipped entirely from directory hashing (not included at all)

**Backup retention policy:**
- Backups stored in central directory: `~/Repos/agents/backups/`
- Naming: timestamp-only directory (e.g., `2026-02-20T182618/`), matching existing convention
- Retention: keep last N backups per target (auto-prune oldest when limit exceeded)
- Backup is mandatory before any file write — atomic write enforces backup-first, no skipBackup escape hatch

**Exclusion filter design:**
- Rules defined in root-level `config.json` (config-driven, not hardcoded)
- Pattern format: glob patterns (e.g., `gsd-*`, `*.bak`)
- `gsd-*` items are managed externally by npx/npm — the sync logic must never read, write, hash, or render them
- Non-canonical files (exist in target dirs but not in canonical source): flag as warning, do not touch
- Format normalization (e.g., `zz/cmd-name` vs `zz-cmd-name`) is a renderer concern, not an exclusion filter concern

### Claude's Discretion

- Exact value of N for backup retention (suggest 5)
- Internal structure of wrapped error context object
- config.json schema for exclusion patterns (key names, nesting)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DIFF-01 | Compute SHA-256 content hash for any file or directory | `Bun.CryptoHasher("sha256")` for file bytes; directory hash via sorted relative-path concatenation. Verified via Context7. |
| FILE-01 | Atomic write (write to temp, fsync, rename) | POSIX temp+fsync+rename pattern. `Bun.write()` for temp, `node:fs` `openSync`/`fsyncSync`/`closeSync`/`renameSync` for durability guarantee. |
| FILE-02 | Backup target file before overwrite (timestamped copy) | Copy to `~/Repos/agents/backups/{timestamp}/` before write. Auto-prune oldest when exceeding N. Matches existing backup convention. |
| EXCL-01 | Skip `gsd-*` files and directories during sync | Config-driven glob patterns via `config.json`. Applied at directory listing boundary via single `isExcluded()` function. |
| EXCL-02 | Skip non-canonical items in targets (don't delete, don't touch) | Exclusion filter returns `{ excluded, nonCanonical }` classification. Non-canonical items flagged as warnings, never modified. |
</phase_requirements>

## Standard Stack

### Core (Phase 1 Only)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Bun built-in: `Bun.CryptoHasher` | Bun ≥1.2 | SHA-256 content hashing | C++ binding, faster than any JS lib. Incremental `.update()`, `.digest("hex")`. No dependency. |
| Bun built-in: `Bun.file()` / `Bun.write()` | Bun ≥1.2 | File read/write | Native async I/O. `.text()`, `.bytes()` for reading. Handles strings/buffers/blobs. |
| Bun built-in: `Bun.Glob` | Bun ≥1.2 | Directory scanning + pattern matching | Native glob. `.scan()` for async iteration. `.match()` for pattern testing. |
| `node:fs` | Node compat | fsync, rename, mkdir, readdir | Bun's `node:fs` is nearly complete. Needed for `fsyncSync`, `renameSync` (atomic write), `readdirSync`, `mkdirSync`. |
| `node:path` | Node compat | Path manipulation | `join`, `resolve`, `relative`, `dirname`, `basename`. Standard. |
| `node:os` | Node compat | Home directory | `os.homedir()` for `~` expansion. |

### Format Parsers

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `jsonc-parser` | ^3.3.1 | JSONC parse/modify with comment preservation | Microsoft/VS Code's own parser. `modify()` + `applyEdits()` for surgical edits preserving comments. Only JS library that does JSONC comment-preserving modifications. |
| `smol-toml` | ^1.6.0 | TOML parse/stringify | TOML 1.1.0 compliant. ~5KB, zero deps. Active development (Cloudflare uses it). |
| `gray-matter` | ^4.0.3 | Markdown frontmatter parse/stringify | 3.5M weekly downloads. `parse()` returns `{ data, content }`. `stringify()` for round-trip. Handles edge cases (YAML with `---` in values, empty frontmatter). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `Bun.CryptoHasher` | `node:crypto.createHash` | Identical API but Bun native is faster. Only switch if targeting Node.js. |
| `Bun.Glob` for exclusion matching | `picomatch` / `minimatch` | External dep but more battle-tested for complex glob semantics. Use `Bun.Glob` first; switch only if edge cases emerge. |
| `smol-toml` | `@iarna/toml` | @iarna is older, larger, not TOML 1.1 compliant. No advantage. |
| `gray-matter` | `front-matter` (npm) | `front-matter` is read-only. We need `stringify()` for round-trip. |
| Custom JSON parser | `jsonc-parser` | Never hand-roll JSONC parsing. Comment handling has edge cases (nested comments, trailing commas, string escapes). |

**Installation (Phase 1 deps only):**
```bash
bun add jsonc-parser@^3.3 smol-toml@^1.6 gray-matter@^4
```

## Architecture Patterns

### Recommended Module Structure (Phase 1)

```
src/
├── infra/                # Infrastructure utilities
│   ├── hash.ts           # SHA-256 file + directory hashing
│   ├── atomic-write.ts   # temp → fsync → rename (calls backup internally)
│   ├── backup.ts         # timestamped backup + retention pruning
│   └── exclusion.ts      # config-driven glob exclusion filter
├── formats/              # Format parsers (pure functions)
│   ├── json.ts           # Plain JSON read/write
│   ├── jsonc.ts          # JSONC read/modify/write (comment-preserving)
│   ├── toml.ts           # TOML parse/stringify
│   └── markdown.ts       # Markdown frontmatter parse/stringify
├── errors.ts             # Custom error subclasses
└── types.ts              # Shared type definitions (Phase 1 subset)
```

### Pattern 1: Custom Error Subclasses with Operation Context

**What:** Every infrastructure function wraps errors with operation context before re-throwing. Each module has its own Error subclass.

**When to use:** All public functions in `infra/` and `formats/`.

**Recommended context structure (Claude's discretion area):**

```typescript
interface ErrorContext {
  operation: string;  // e.g. "atomicWrite", "hashFile", "backupFile"
  path: string;       // file/directory being operated on
  cause: Error;       // original system error
}

class AtomicWriteError extends Error {
  readonly operation: string;
  readonly path: string;
  override readonly cause: Error;

  constructor(message: string, context: ErrorContext) {
    super(message, { cause: context.cause });
    this.name = 'AtomicWriteError';
    this.operation = context.operation;
    this.path = context.path;
    this.cause = context.cause;
  }
}

// Same pattern for HashError, BackupError, ParseError
```

**Rationale:** ES2022 `Error.cause` is supported in Bun. Storing `operation` and `path` as properties (not just in the message string) enables structured error handling in callers and JSON serialization for agent output.

### Pattern 2: Backup-First Atomic Write (Composition)

**What:** `atomicWrite()` is the sole file-write entry point. It always backs up the target first (if it exists), then writes atomically. No `skipBackup` escape hatch.

**When to use:** Every file write in the system. No direct `Bun.write()` or `fs.writeFileSync()` outside of `atomic-write.ts`.

```typescript
async function atomicWrite(
  targetPath: string,
  content: string | Uint8Array,
): Promise<void> {
  // 1. Backup existing file (if it exists)
  await backupFile(targetPath);

  // 2. Write to temp file (same directory = same filesystem)
  const tmpPath = `${targetPath}.tmp.${process.pid}.${Date.now()}`;
  await Bun.write(tmpPath, content);

  // 3. fsync for durability
  const fd = openSync(tmpPath, 'r');
  fsyncSync(fd);
  closeSync(fd);

  // 4. Atomic rename
  renameSync(tmpPath, targetPath);
}
```

**Key details:**
- Temp file in same directory as target (ensures same filesystem for atomic rename)
- PID + timestamp in temp name prevents collisions in parallel runs
- `fsyncSync` forces data to disk before rename
- `renameSync` is atomic on POSIX (macOS, Linux)
- If any step fails, original file is untouched (temp file is orphaned, can be cleaned up)

### Pattern 3: Directory Hashing via Sorted File Manifest

**What:** Hash a directory by sorting all non-excluded files by relative path, concatenating `relativePath + contentHash` for each, and hashing the composite.

**When to use:** Any directory-level drift detection (commands dir, agents dir, skills dir).

```typescript
async function hashDirectory(
  dirPath: string,
  isExcluded: (name: string) => boolean,
): Promise<string> {
  const entries: Array<{ relativePath: string; contentHash: string }> = [];

  // Collect all files recursively, skipping excluded
  const glob = new Bun.Glob('**/*');
  for await (const file of glob.scan({ cwd: dirPath, onlyFiles: true })) {
    if (isExcluded(file)) continue;
    const fullPath = path.join(dirPath, file);
    const contentHash = await hashFile(fullPath);
    entries.push({ relativePath: file, contentHash });
  }

  // Sort by relative path for determinism
  entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  // Hash the composite
  const hasher = new Bun.CryptoHasher('sha256');
  for (const entry of entries) {
    hasher.update(entry.relativePath);
    hasher.update(entry.contentHash);
  }
  return hasher.digest('hex');
}
```

### Pattern 4: Config-Driven Exclusion Filter

**What:** A single `createExclusionFilter()` function loads glob patterns from `config.json` and returns a predicate. Applied at directory listing boundaries only.

**Recommended config.json schema (Claude's discretion area):**

```json
{
  "sync": {
    "exclusions": [
      "gsd-*",
      ".gsd-*",
      ".sync-manifest.json",
      ".DS_Store",
      "*.bak"
    ],
    "backupRetention": 5
  }
}
```

**Rationale:** Flat array of glob patterns is simplest. No nesting needed since all exclusion patterns are the same type (glob). `backupRetention` co-located under `sync` key since it's sync-specific config. Key name `sync` namespaces these settings away from potential future non-sync config.

```typescript
function createExclusionFilter(patterns: string[]): (name: string) => boolean {
  const globs = patterns.map((p) => new Bun.Glob(p));
  return (name: string) => globs.some((g) => g.match(name));
}
```

### Anti-Patterns to Avoid

- **Direct `Bun.write()` for target files:** Always go through `atomicWrite()`. No shortcuts.
- **`JSON.parse()` for JSONC files:** Use `jsonc-parser` exclusively. `JSON.parse` silently strips comments.
- **Exclusion logic per-module:** Single `isExcluded()` function, imported everywhere. No inline glob checks.
- **Mutable sort for hashing:** Use `Array.prototype.sort()` with `localeCompare` — deterministic. Don't rely on filesystem order.
- **Hardcoded backup path:** Read from config or compute from `os.homedir()`. Never inline `"/Users/.../backups/"`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSONC parsing with comments | Custom regex/string parser | `jsonc-parser` (Microsoft) | Edge cases: nested comments, trailing commas, string escapes containing `//`. VS Code's own parser handles all of these. |
| YAML frontmatter parsing | Split on `---` regex | `gray-matter` | Edge cases: YAML values containing `---`, empty frontmatter, different delimiters, re-assembly with `stringify()`. |
| TOML serialization | Manual string building | `smol-toml` stringify | TOML type system (integer vs float, inline tables vs sections, datetime format) is deceptively complex. |
| SHA-256 hashing | `node:crypto` | `Bun.CryptoHasher` | C++ binding is faster. Identical API but avoids importing `node:crypto`. |
| `.env` file loading | `dotenv` package | Bun native `.env` loading | Bun reads `.env` files automatically. Zero config. `Bun.env` and `process.env` work out of the box. |
| Glob pattern matching | Custom regex | `Bun.Glob` | Glob semantics have edge cases (nested patterns, negation, dotfiles). Native implementation is correct and fast. |

**Key insight:** Every "simple" problem here has edge cases that take days to debug. The libraries are small, well-tested, and purpose-built. The only hand-rolled logic should be the composition (atomic write = temp + fsync + rename, backup = copy + prune, directory hash = sort + concat + hash).

## Common Pitfalls

### Pitfall 1: Temp File on Different Filesystem Breaks Atomic Rename

**What goes wrong:** Writing temp file to `/tmp/` and renaming to `~/.config/opencode/` fails because `rename()` across filesystems is not atomic — it becomes copy+delete.
**Why it happens:** macOS `/tmp` → `/private/tmp` is a different mount point from `/Users/`.
**How to avoid:** Always create temp file in the **same directory** as the target: `${targetPath}.tmp.${pid}`.
**Warning signs:** `EXDEV` error from `rename()`. Or: rename "succeeds" but is actually copy+delete (non-atomic).

### Pitfall 2: Missing fsync Means Data Loss on Crash

**What goes wrong:** `Bun.write()` returns successfully but data is in kernel buffer, not on disk. Power loss before disk flush = empty or corrupt file after rename.
**Why it happens:** `Bun.write()` doesn't guarantee fsync. The OS may buffer writes for performance.
**How to avoid:** Explicit `fsyncSync(fd)` between write and rename. Open the temp file read-only, fsync, close, then rename.
**Warning signs:** No `fsync` call in the write path. Tests pass (no power failures in tests) but production loses data.

### Pitfall 3: Backup Directory Not Created Before First Write

**What goes wrong:** First-ever sync run fails because `~/Repos/agents/backups/2026-02-20T123456/` doesn't exist yet.
**Why it happens:** `copyFileSync` doesn't create parent directories.
**How to avoid:** `mkdirSync(backupDir, { recursive: true })` before any copy. Call in `backupFile()` unconditionally — `recursive: true` is a no-op if directory exists.
**Warning signs:** "ENOENT: no such file or directory" error on first sync.

### Pitfall 4: Directory Hash Non-Determinism from Locale-Dependent Sort

**What goes wrong:** `Array.sort()` without a comparator uses locale-sensitive string ordering. Same files, different hash on machines with different locales.
**Why it happens:** Default sort is `toString()` comparison which depends on locale for certain characters.
**How to avoid:** Always use explicit `localeCompare('en')` or byte-level comparison. Or simpler: use `.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))` for pure byte ordering.
**Warning signs:** Hash differs between macOS (developer) and CI (Linux) for directories with non-ASCII filenames.

### Pitfall 5: gray-matter stringify Reorders YAML Keys

**What goes wrong:** `gray-matter.stringify(content, data)` may output YAML keys in a different order than the original. Not a bug (YAML spec says key order is irrelevant), but creates noisy diffs.
**Why it happens:** gray-matter uses `js-yaml` internally, which serializes object properties in insertion order. If the parsed `data` object is spread or cloned, key order may change.
**How to avoid:** Don't depend on YAML key ordering for diff/hash. Hash the parsed data structure, not the raw frontmatter string. If ordering matters for aesthetics, sort keys before stringify.
**Warning signs:** "Changed" files where only the YAML key order differs.

### Pitfall 6: macOS `/var` ↔ `/private/var` Path Mismatch

**What goes wrong:** `path.resolve('/tmp/foo')` returns `/tmp/foo` but `fs.realpathSync('/tmp/foo')` returns `/private/tmp/foo`. Hash comparisons with paths as input produce different results.
**Why it happens:** macOS firmlinks. `/tmp`, `/var`, `/etc` are symlinks to `/private/*`.
**How to avoid:** Normalize all paths through `realpathSync()` at input boundaries. Single `normalizePath()` utility. Or: never include absolute paths in hashes — use relative paths only (current design already does this for directory hashing).
**Warning signs:** Phantom "drift detected" on every check. Same file, different hash.

## Code Examples

Verified patterns from official sources:

### File Hashing with Bun.CryptoHasher

```typescript
// Source: Context7 /oven-sh/bun — Bun.CryptoHasher docs
async function hashFile(filePath: string): Promise<string> {
  const bytes = await Bun.file(filePath).bytes();
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(bytes);
  return hasher.digest('hex');
}
```

### Atomic Write with fsync

```typescript
// Source: POSIX standard pattern, verified with Bun node:fs compat
import { openSync, fsyncSync, closeSync, renameSync } from 'node:fs';

async function atomicWriteRaw(
  targetPath: string,
  content: string | Uint8Array,
): Promise<void> {
  const tmpPath = `${targetPath}.tmp.${process.pid}.${Date.now()}`;
  try {
    await Bun.write(tmpPath, content);
    const fd = openSync(tmpPath, 'r');
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmpPath, targetPath);
  } catch (error) {
    // Clean up temp file on failure
    try { await Bun.file(tmpPath).delete(); } catch { /* ignore */ }
    throw error;
  }
}
```

### JSONC Modify with Comment Preservation

```typescript
// Source: jsonc-parser README — modify + applyEdits API
import { modify, applyEdits, type FormattingOptions } from 'jsonc-parser';

const formatting: FormattingOptions = {
  tabSize: 2,
  insertSpaces: true,
  eol: '\n',
};

function setJsoncValue(
  existingText: string,
  path: (string | number)[],
  value: unknown,
): string {
  const edits = modify(existingText, path, value, { formattingOptions: formatting });
  return applyEdits(existingText, edits);
}

// Usage: preserves all comments and formatting outside the edited path
const updated = setJsoncValue(originalJsonc, ['mcpServers', 'tavily'], newConfig);
```

### Markdown Frontmatter Round-Trip

```typescript
// Source: Context7 /jonschlinkert/gray-matter — parse + stringify
import matter from 'gray-matter';

function parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  const { data, content } = matter(raw);
  return { data, content };
}

function stringifyFrontmatter(content: string, data: Record<string, unknown>): string {
  return matter.stringify(content, data);
}
```

### TOML Parse/Stringify

```typescript
// Source: smol-toml npm — parse/stringify
import { parse as parseTOML, stringify as stringifyTOML } from 'smol-toml';

function readToml(raw: string): Record<string, unknown> {
  return parseTOML(raw);
}

function writeToml(data: Record<string, unknown>): string {
  return stringifyTOML(data);
}
```

### Exclusion Filter from Config

```typescript
// Source: Bun.Glob docs (Context7)
function createExclusionFilter(patterns: string[]): (name: string) => boolean {
  const globs = patterns.map((p) => new Bun.Glob(p));
  return (name: string) => {
    const basename = name.split('/').pop() ?? name;
    return globs.some((g) => g.match(basename));
  };
}
```

### Backup with Retention Pruning

```typescript
// Source: node:fs + domain knowledge
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

function backupFile(
  filePath: string,
  backupRoot: string,
  maxBackups: number,
): void {
  if (!existsSync(filePath)) return; // nothing to back up

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', 'T')
    .slice(0, 17); // "20260220T182618"

  const backupDir = join(backupRoot, timestamp);
  mkdirSync(backupDir, { recursive: true });
  cpSync(filePath, join(backupDir, basename(filePath)));

  // Prune oldest backups beyond maxBackups
  const allBackups = readdirSync(backupRoot)
    .sort()  // timestamp names sort chronologically
    .reverse();
  for (const old of allBackups.slice(maxBackups)) {
    rmSync(join(backupRoot, old), { recursive: true, force: true });
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `dotenv` package for .env loading | Bun native `.env` auto-loading | Bun 1.0 (Sep 2023) | Zero dependency for env vars. `Bun.env` and `process.env` work automatically. |
| `node:crypto.createHash` | `Bun.CryptoHasher` | Bun 1.0 | C++ binding, faster. Same API pattern (`.update()`, `.digest()`). |
| `fs-extra.copy` / `fs-extra.move` | `Bun.write()` + `node:fs` rename | Bun 1.0 | No dependency needed. `Bun.write()` handles strings/buffers natively. |
| `JSON.parse` + `JSON.stringify` for JSONC | `jsonc-parser` modify/applyEdits | VS Code adoption (2018+) | Comment preservation is non-negotiable for user-edited config files. |
| `@iarna/toml` | `smol-toml` | Dec 2024 (v1.6.0) | TOML 1.1.0 compliant, smaller, actively maintained. @iarna effectively unmaintained. |

## Open Questions

1. **`Bun.Glob.match()` behavior for exclusion patterns**
   - What we know: `Bun.Glob.scan()` is well-documented for directory traversal. `Bun.Glob.match()` exists for testing a single string against a pattern.
   - What's unclear: Does `match()` work on basenames only, or does it require full paths? Does it handle `*` matching within path segments correctly?
   - Recommendation: Verify with a quick test during implementation. If `Bun.Glob` doesn't support basename-only matching, fall back to `picomatch` (~3KB, well-tested). LOW risk — simple to swap.

2. **Backup granularity: per-file vs per-sync-run**
   - What we know: CONTEXT.md says "keep last N backups per target." Existing convention uses one timestamp dir per sync run containing all backed-up files.
   - What's unclear: Does "per target" mean per CLI target (claude, opencode, etc.) or per file? If per-file, the retention count applies individually to each file's backup history.
   - Recommendation: Match existing convention — one timestamp dir per sync run, retention prunes entire timestamp dirs. "Per target" clarification can come during planning. This is the simpler, safer interpretation.

3. **Backup path structure for atomicWrite**
   - What we know: `atomicWrite` must back up before writing. Existing backups organize as `backups/{timestamp}/{cli}/`.
   - What's unclear: When `atomicWrite` is called for a single file (not part of a sync run), what's the backup path? Creating a new timestamp dir per individual write seems wasteful.
   - Recommendation: `atomicWrite` accepts a `backupDir` parameter. The caller (orchestrator/executor) creates one timestamp dir per sync run and passes it to all writes. Individual writes outside a sync run create their own timestamp dir.

## Discretion Recommendations

### Backup Retention Count: N = 5

**Recommendation:** Keep last 5 backups.

**Rationale:** Existing backups/ dir has 5 entries currently. 5 provides a week's worth of daily syncs with headroom. More than 10 is wasteful (each backup is ~100KB). Fewer than 3 is risky (one bad sync + one panic re-sync = only 1 good backup left).

### Error Context Structure

**Recommendation:**

```typescript
interface ErrorContext {
  operation: string;  // function name: "atomicWrite", "hashFile", etc.
  path: string;       // absolute path being operated on
  cause: Error;       // original Error (preserved via ES2022 Error.cause)
}
```

**Rationale:** Three fields cover all debugging needs. `operation` identifies the function. `path` identifies the file. `cause` preserves the full original stack trace. Using ES2022 `Error.cause` (supported in Bun) means standard error tooling can traverse the cause chain.

### config.json Schema for Exclusions

**Recommendation:**

```json
{
  "sync": {
    "exclusions": ["gsd-*", ".gsd-*", ".sync-manifest.json", ".DS_Store"],
    "backupRetention": 5
  }
}
```

**Rationale:** Flat `exclusions` array of glob strings — simplest possible schema. `backupRetention` co-located since it's sync-related. `sync` namespace keeps the door open for non-sync config keys later. No nesting beyond one level; no need for per-pattern options (include/exclude modes, path vs basename matching).

## Sources

### Primary (HIGH confidence)
- Context7 `/oven-sh/bun` — CryptoHasher SHA-256 API, Bun.file/Bun.write API, Bun.Glob API, node:fs compat, .env auto-loading
- Context7 `/jonschlinkert/gray-matter` — parse/stringify frontmatter API, custom delimiters
- `jsonc-parser` README (github.com/microsoft/node-jsonc-parser) — full API: parse, modify, applyEdits, format, FormattingOptions
- Existing codebase: `backups/` directory structure (5 existing timestamp dirs), `.gitignore` (backups/ excluded), `package.json` (Bun project)

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` — stack decisions (cross-verified with Context7)
- `.planning/research/PITFALLS.md` — pitfall catalog (derived from SYNC.md battle-tested edge cases + vsync analysis)
- `.planning/research/ARCHITECTURE.md` — module structure and dependency direction

### Tertiary (LOW confidence)
- `smol-toml` API — verified via npm listing and GitHub releases but not via Context7 (library not indexed). Parse/stringify API is standard and unlikely to differ from documented behavior.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified via Context7 or official docs; Bun built-ins verified via official Bun docs
- Architecture: HIGH — module structure follows established project research, well-understood POSIX primitives
- Pitfalls: HIGH — derived from first-hand SYNC.md experience and vsync source analysis; all Phase 1 relevant pitfalls are well-characterized

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable domain — POSIX primitives, mature libraries)
