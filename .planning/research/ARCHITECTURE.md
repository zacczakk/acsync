# Architecture Research

**Domain:** Deterministic config sync CLI tool
**Researched:** 2026-02-20
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
 ┌───────────────────────────────────────────────────────────────────┐
 │                         CLI Layer                                 │
 │   sync | check | status | diff                                    │
 ├───────────────────────────────────────────────────────────────────┤
 │                      Orchestrator                                 │
 │   reads source → builds plan → confirms → executes → reports      │
 ├──────────────┬──────────────┬─────────────┬──────────────────────┤
 │   Planner    │  Manifest    │   Sync      │   Reporter           │
 │   (3-way     │  Manager     │   Executor  │   (human + JSON)     │
 │    diff)     │  (hash DB)   │   (atomic)  │                      │
 ├──────────────┴──────────────┴─────────────┴──────────────────────┤
 │                     Adapter Layer                                 │
 │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
 │  │  Claude   │ │ OpenCode │ │  Gemini  │ │  Codex   │            │
 │  │  Adapter  │ │ Adapter  │ │  Adapter │ │  Adapter │            │
 │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘            │
 │       └─────────────┴─────────────┴─────────────┘                 │
 │                   BaseAdapter (shared read/write)                  │
 ├───────────────────────────────────────────────────────────────────┤
 │                     Format Layer                                  │
 │  ┌─────────┐ ┌─────────┐ ┌─────────────┐ ┌──────────────┐       │
 │  │  JSON   │ │  JSONC  │ │    TOML     │ │   Markdown   │       │
 │  │  R/W    │ │  R/W    │ │    R/W      │ │  Frontmatter │       │
 │  └─────────┘ └─────────┘ └─────────────┘ └──────────────┘       │
 ├───────────────────────────────────────────────────────────────────┤
 │                    Infrastructure                                 │
 │  ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
 │  │  Atomic   │ │  Backup  │ │  Hash    │ │  Env Var │           │
 │  │  Write    │ │  Rollback│ │  Utils   │ │  Xform   │           │
 │  └───────────┘ └──────────┘ └──────────┘ └──────────┘           │
 └───────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| **CLI Layer** | Parse args, route to orchestrator, exit codes | Orchestrator, Reporter |
| **Orchestrator** | Coordinate full sync lifecycle | All core components |
| **Planner** | 3-way diff (source vs target vs manifest), produce SyncPlan | Manifest Manager, Adapters |
| **Manifest Manager** | Load/save hash-based manifest, track sync state | Planner, Sync Executor |
| **Sync Executor** | Execute plan operations per-target, handle errors | Adapters, Backup/Rollback |
| **Reporter** | Format output (human-readable or structured JSON) | CLI Layer |
| **Adapter Layer** | Read/write config items per CLI target | Format Layer |
| **Format Layer** | Parse/serialize JSON, JSONC, TOML, Markdown | Filesystem |
| **Infrastructure** | Atomic writes, backup/rollback, hashing, env var transforms | Used by all layers |

## Recommended Project Structure

```
src/
├── cli/                  # CLI entry point, arg parsing, commands
│   ├── index.ts          # main entry, command router
│   ├── commands/         # sync, check, status, diff
│   └── reporter.ts       # output formatting (human + JSON)
├── core/                 # Domain logic (no I/O knowledge)
│   ├── planner.ts        # 3-way diff → SyncPlan
│   ├── diff.ts           # hash comparison, operation classification
│   ├── manifest.ts       # manifest load/save/update
│   ├── executor.ts       # execute plan against adapters
│   └── orchestrator.ts   # coordinates full sync lifecycle
├── adapters/             # Per-target adapters
│   ├── base.ts           # BaseAdapter abstract class
│   ├── registry.ts       # AdapterRegistry (factory + discovery)
│   ├── claude.ts         # Claude Code adapter
│   ├── opencode.ts       # OpenCode adapter
│   ├── gemini.ts         # Gemini CLI adapter
│   └── codex.ts          # Codex adapter
├── formats/              # Format converters (pure functions)
│   ├── json.ts           # JSON read/write
│   ├── jsonc.ts          # JSONC read/write (preserves comments)
│   ├── toml.ts           # TOML read/write
│   └── markdown.ts       # Markdown frontmatter read/write
├── transforms/           # Content transformers
│   ├── env-var.ts        # Environment variable format conversion
│   ├── settings-merge.ts # Subset merge strategies
│   └── naming.ts         # Naming convention transforms (prefix strip, etc.)
├── infra/                # Infrastructure utilities
│   ├── atomic-write.ts   # temp → fsync → rename
│   ├── backup.ts         # backup/restore/cleanup
│   ├── hash.ts           # SHA256 content hashing
│   └── fs.ts             # filesystem helpers (ensureDir, etc.)
└── types/                # Shared type definitions
    ├── config.ts         # Tool config, sync config
    ├── manifest.ts       # Manifest, ManifestItem
    ├── plan.ts           # SyncPlan, Operation, DiffResult
    └── models.ts         # ConfigItem, Command, Agent, etc.
```

### Structure Rationale

- **`cli/`**: Thin shell. Parses args, calls orchestrator, formats output. No business logic.
- **`core/`**: All domain logic. Testable without filesystem. Pure functions where possible.
- **`adapters/`**: One file per CLI target. Each knows its directory layout, file names, format quirks. Extends BaseAdapter for shared behavior.
- **`formats/`**: Pure parse/serialize functions. No adapter knowledge. Reusable across adapters.
- **`transforms/`**: Content mutation logic (env vars, merge strategies, naming). Separated from formats because transforms operate on parsed data, formats operate on raw strings.
- **`infra/`**: OS-level utilities. Thin wrappers over `node:fs` with error handling and atomicity guarantees.
- **`types/`**: Shared interfaces. No runtime code. Imported everywhere.

## Architectural Patterns

### Pattern 1: Adapter Pattern (from vsync)

**What:** Each CLI target (Claude, OpenCode, Gemini, Codex) implements a `TargetAdapter` interface. A `BaseAdapter` provides shared behavior. An `AdapterRegistry` handles discovery and instantiation.

**When to use:** Any time the system needs to read from or write to a target CLI's config directory.

**Trade-offs:** More files to maintain per adapter, but each adapter is small (~100-200 LOC) and independently testable. Adding a 5th CLI = adding one file + registering it.

**Example:**
```typescript
interface TargetAdapter {
  readonly id: TargetId;
  readonly displayName: string;

  // Path resolution
  getConfigDir(): string;
  getItemPath(type: ConfigType, name: string): string;

  // Read (returns normalized models)
  readItems(type: ConfigType): Promise<ConfigItem[]>;
  readSettings(): Promise<Record<string, unknown>>;

  // Write (accepts normalized models, converts to target format)
  writeItems(type: ConfigType, items: ConfigItem[]): Promise<WriteResult>;
  writeSettings(settings: Record<string, unknown>): Promise<WriteResult>;

  // Delete
  deleteItem(type: ConfigType, name: string): Promise<void>;
}

abstract class BaseAdapter implements TargetAdapter {
  // Shared: readMarkdownItems, writeMarkdownItems, hash computation
  // Each subclass overrides: getConfigDir, format-specific methods
}
```

**Key difference from vsync:** Our source is always `configs/common/` (not another adapter). Adapters only need write + read-for-diff. No source adapter selection.

### Pattern 2: 3-Way Diff with Manifest (from vsync + chezmoi)

**What:** Compare source hash, target hash, and manifest hash to classify each item as CREATE, UPDATE, DELETE, or SKIP. The manifest acts as "last known synced state" — the equivalent of chezmoi's persistent state.

**When to use:** Every sync operation. The planner runs this for each target.

**Trade-offs:** Requires manifest storage (~1 file), but enables incremental sync and conflict detection. Without it, every sync is a full overwrite.

**Example:**
```typescript
function classifyOperation(
  sourceHash: string | null,
  targetHash: string | null,
  manifestHash: string | null,
): OperationType {
  if (!sourceHash) return 'delete';     // removed from source
  if (!targetHash) return 'create';     // new in source
  if (sourceHash === targetHash) return 'skip';  // already in sync
  return 'update';                      // content changed
}
```

### Pattern 3: Settings Subset Merge (unique to our domain)

**What:** Settings files (e.g., OpenCode's `settings.jsonc`) contain both managed keys (synced by us) and user-owned keys (never touched). A merge strategy map declares per-key behavior.

**When to use:** Any config type where the target file contains keys outside our management scope.

**Trade-offs:** Adds complexity but is essential. Without it, we'd either clobber user settings or fail to update managed ones.

**Example:**
```typescript
// Merge strategy per settings key
type MergeStrategy = 'overwrite' | 'preserve' | 'deep-merge';

interface SettingsSpec {
  managedKeys: Record<string, MergeStrategy>;
  // Keys not in managedKeys are preserved untouched
}

const openCodeSettings: SettingsSpec = {
  managedKeys: {
    'model': 'preserve',           // user choice, don't touch
    'hooks': 'preserve',           // user-specific
    'agents': 'deep-merge',        // merge our agents with theirs
    'mcp': 'overwrite',            // we own this entirely
  }
};
```

### Pattern 4: Atomic Write with Rollback (from vsync)

**What:** All file writes use temp-file → fsync → rename. Before sync, backup target files. On failure, restore from backup. On success, delete backups.

**When to use:** Every file write operation.

**Trade-offs:** Slightly slower (fsync + rename vs direct write), but crash-safe. A power failure mid-sync won't corrupt files.

```typescript
async function atomicWrite(path: string, content: string): Promise<void> {
  const tmp = `${path}.tmp.${randomHex(8)}`;
  await writeFile(tmp, content);
  const fd = await open(tmp, 'r+');
  await fd.sync();
  await fd.close();
  await rename(tmp, path);  // atomic on POSIX
}
```

### Pattern 5: Structured Output for Agent Consumption

**What:** CLI supports `--json` flag producing machine-readable output. Operations, results, and errors are structured objects — not just formatted strings.

**When to use:** When agents (not humans) invoke the sync tool.

**Trade-offs:** Dual output paths, but essential for automation. Agents parse JSON; humans read colored text.

```typescript
interface SyncReport {
  timestamp: string;
  targets: Record<string, TargetReport>;
  summary: { created: number; updated: number; deleted: number; skipped: number };
  errors: SyncError[];
}
```

## Data Flow

### Sync Flow (primary path)

```
configs/common/                    Target directories
  commands/ (17 .md)               ~/.claude/commands/zz/
  agents/ (8 .md)         ───┐    ~/.config/opencode/agents/
  skills/ (2 dirs)            │    ~/.config/gemini/agents/
  mcp/ (6 .json)              │    ~/.codex/agents/
  settings/ (2 .json)         │
  instructions/ (4 .md)       │
                              ▼
                     ┌────────────────┐
                     │  Source Reader  │  Read all items from configs/common/
                     │  (hash each)   │  Normalize to ConfigItem[]
                     └───────┬────────┘
                             │
                     ┌───────▼────────┐
                     │  Manifest      │  Load last-sync hashes
                     │  Manager       │  from .planning/manifest.json
                     └───────┬────────┘
                             │
              ┌──────────────▼──────────────┐
              │         Planner             │
              │  For each target:           │
              │    1. Read target state      │
              │    2. 3-way diff             │
              │    3. Classify operations    │
              │  Output: SyncPlan           │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │    Per-Target Executor       │
              │  1. Backup target files      │
              │  2. Transform + write items  │
              │  3. On error: rollback       │
              │  4. On success: cleanup      │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │    Manifest Update          │
              │  Record new hashes          │
              │  Atomic write manifest      │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │    Reporter                 │
              │  Format results (human/JSON)│
              │  Exit code (0=ok, 1=error)  │
              └─────────────────────────────┘
```

### Config Item Lifecycle

```
Source (.md file)
    │
    ▼
Parse (gray-matter frontmatter + content body)
    │
    ▼
Normalize (ConfigItem: name, content, metadata, hash)
    │
    ▼
Transform per-target:
  ├─ Naming:     strip "zz-" prefix (Claude), keep as-is (others)
  ├─ Format:     rebuild frontmatter (YAML→TOML for Gemini)
  ├─ Env vars:   ${VAR} → {env:VAR} (OpenCode)
  └─ Structure:  commands/ → commands/zz/ (Claude subdirectory)
    │
    ▼
Write (atomic: temp → fsync → rename)
```

### Settings Merge Flow

```
Source settings.json              Target opencode.jsonc
  (managed keys only)             (full file with user keys)
         │                                  │
         ▼                                  ▼
    Parse JSON                        Parse JSONC
         │                                  │
         └──────────┬───────────────────────┘
                    ▼
            Settings Merger
          ┌─────────────────┐
          │ For each key:   │
          │  overwrite: src │
          │  preserve: tgt  │
          │  deep-merge:    │
          │    {...tgt, ...src}
          │  unmanaged: tgt │
          └────────┬────────┘
                   ▼
            Serialize JSONC
            (preserve comments)
                   │
                   ▼
            Atomic Write
```

## Anti-Patterns

### Anti-Pattern 1: God Adapter

**What people do:** Put all format conversion, path resolution, and settings merge logic inside each adapter.
**Why it's wrong:** Duplicates logic across 4 adapters. Format converters and merge strategies change independently from adapter directory layouts.
**Do this instead:** Adapters compose format converters and merge strategies. Adapters know *where* things go; formats know *how* to serialize; transforms know *what* to change.

### Anti-Pattern 2: Full Overwrite Without Manifest

**What people do:** Skip the manifest and always overwrite target files.
**Why it's wrong:** Can't detect "no changes needed" (wasteful). Can't detect user modifications to target files. Can't provide meaningful dry-run output.
**Do this instead:** Hash-based manifest tracks last-synced state. 3-way diff enables precise CREATE/UPDATE/DELETE/SKIP classification.

### Anti-Pattern 3: Non-Atomic Writes

**What people do:** Direct `writeFile()` to target path.
**Why it's wrong:** Crash mid-write = corrupted config = broken CLI tool. Partial JSON is unrecoverable.
**Do this instead:** Write to temp file, fsync, rename. Always.

### Anti-Pattern 4: Hardcoded Target Paths

**What people do:** Scatter path strings like `~/.claude/commands/zz/` throughout the codebase.
**Why it's wrong:** Path logic is adapter-specific. Hardcoding makes testing impossible without real filesystem.
**Do this instead:** Each adapter owns its path resolution via `getConfigDir()` and `getItemPath()`. Tests inject a temp directory as `baseDir`.

### Anti-Pattern 5: Merging Everything the Same Way

**What people do:** Use one merge strategy for all settings keys (either full overwrite or full preserve).
**Why it's wrong:** Some keys are ours to manage (MCP servers), some are user-owned (model preferences), some need deep merge (agent lists with user additions). One strategy doesn't fit all.
**Do this instead:** Per-key merge strategy maps. Each settings file declares which keys use which strategy.

## Build Order (Dependency Chain)

Components should be built in this order — each layer depends only on layers above it:

| Phase | Components | Rationale |
|-------|-----------|-----------|
| **1** | `types/`, `infra/` (hash, atomic-write, fs) | Zero dependencies. Foundation for everything. |
| **2** | `formats/` (JSON, JSONC, TOML, markdown) | Depends on types only. Pure parse/serialize. |
| **3** | `transforms/` (env-var, settings-merge, naming) | Depends on types. Operates on parsed data. |
| **4** | `adapters/` (base, registry, 4 targets) | Depends on formats + transforms + infra. |
| **5** | `core/` (manifest, diff, planner) | Depends on types + adapters (for reading). |
| **6** | `core/` (executor, orchestrator) | Depends on planner + adapters + infra (backup). |
| **7** | `cli/` (commands, reporter) | Depends on orchestrator. Thin shell. |

**Key insight:** Phases 1-3 are pure logic with no adapter knowledge. They can be built, tested, and stabilized before any adapter code exists. Phase 4 (adapters) is the most labor-intensive but each adapter is independent — they can be built in parallel.

### Dependency Direction

```
cli/ → core/ → adapters/ → formats/ + transforms/ → infra/ → types/
```

No reverse dependencies. No circular imports. Each layer depends only on layers to its right.

## Integration Points

### Source Directory (read-only)

| Resource | Path | Format | Notes |
|----------|------|--------|-------|
| Commands | `configs/common/commands/*.md` | Markdown + frontmatter | 17 files |
| Agents | `configs/common/agents/*.md` | Markdown + frontmatter | 8 files |
| Skills | `configs/common/skills/*/` | Directory with SKILL.md | 2 skill dirs |
| MCP Servers | `configs/common/mcp/*.json` | JSON | 6 server configs |
| Settings | `configs/common/settings/*.json` | JSON | 2 settings files |
| Instructions | `configs/common/instructions/*.md` | Markdown | 4 instruction files |

### Target Directories (read + write)

| Target | Config Dir | Command Format | Settings Format | MCP Format |
|--------|-----------|----------------|-----------------|------------|
| Claude Code | `~/.claude/` | `.md` in `commands/zz/` | N/A (uses `settings.json` differently) | `.json` |
| OpenCode | `~/.config/opencode/` | `.md` in `command/` (singular) | `.jsonc` (JSONC with comments) | `.json` inside settings |
| Gemini | `~/.config/gemini/` | `.toml` in `command/` | `.toml` | `.toml` |
| Codex | `~/.codex/` | `.md` in `command/` | N/A | `.toml` |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| CLI ↔ Orchestrator | Function call with typed config | CLI passes parsed args; orchestrator returns SyncReport |
| Orchestrator ↔ Planner | Source items + manifest → SyncPlan | Planner is a pure function |
| Orchestrator ↔ Executor | SyncPlan + adapters → SyncResult | Executor handles backup/rollback internally |
| Adapter ↔ Format | Adapter calls format.parse/serialize | Format layer has no adapter knowledge |
| Adapter ↔ Transform | Adapter calls transform.apply(item, target) | Transforms are pure functions |

## Sources

- **vsync** (primary reference): `~/Repos/oss/vsync` — studied adapter pattern, diff engine, sync executor, parallel orchestrator, rollback, manifest manager, env var transformer, atomic write. 612 tests, production-grade. HIGH confidence.
- **chezmoi** architecture: https://chezmoi.io/developer-guide/architecture/ — source state / target state / actual state model, persistent state with SHA256 hashes, System interface abstraction, path type safety. HIGH confidence (official docs).
- **Domain knowledge**: existing sync script in `~/Repos/agents` (bash, ~400 LOC), 4 CLI target formats studied from AGENTS.md sync learnings. HIGH confidence (first-hand).

---
*Architecture research for: deterministic config sync CLI tool*
*Researched: 2026-02-20*
