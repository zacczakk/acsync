# vsync Alignment & Codex Multi-Agent Integration

## Context

Full comparative review of acsync (`~/Repos/acsync`) vs vsync (`~/Repos/oss/vsync`) completed. vsync is an OSS tool solving the same problem (sync AI assistant configs across CLIs) with a more mature implementation. This plan captures findings and proposed actions.

Reference: vsync repo at `~/Repos/oss/vsync/cli/src/`

---

## Part 1: vsync Patterns Worth Borrowing

### High Priority (correctness fixes)

#### 1. Metadata-Aware Hashing

**Problem**: acsync hashes raw file content only (`src/cli/canonical.ts:34-54`). If metadata or support files change without content changes, the diff engine misses it.

**vsync approach** (`utils/hash.ts:34-52`): `hashBaseItem()` normalizes content (trimmed) + sorts metadata keys + includes support files, joined as `content\nmetadata\nsupportFiles`. Separate `hashMCPServer()` (`utils/hash.ts:83-122`) builds stable config representation with sorted keys for nested objects.

**Action**: Extract hashing into a standalone `src/core/hash.ts` module. Implement `hashCanonicalItem()` and `hashMCPServer()` with normalized, key-sorted hashing.

#### 2. True 3-Way Diff

**Problem**: acsync accepts `manifestHash` in `compareHashes()` but voids it (`src/core/diff.ts:50`). This means independent target modifications are silently overwritten without detection.

**vsync approach** (`core/diff.ts:65-122`): 6-case algorithm uses manifest hash to distinguish "source changed" from "target independently modified" and detect ghost items (previously synced, now absent).

**Action**: Implement vsync's 6-case `compareHashes()`. Use manifest hash for case 5 (target modified independently — warn) and manifest ghost scan for prune-mode delete detection.

#### 3. Prune/Delete Mode

**Problem**: acsync's `compareHashes()` never returns `delete`. The `--delete` flag on push handles stale items separately, outside the diff algorithm.

**vsync approach** (`core/diff.ts:76-80`): `compareHashes()` accepts `mode: 'safe' | 'prune'`. In prune mode, items absent from source produce delete operations naturally in the diff engine.

**Action**: Add `mode` parameter to `compareHashes()`. Integrate delete into the diff algorithm instead of handling it ad-hoc in the push command.

#### 4. Capability Enforcement

**Problem**: All 4 acsync adapters declare full capabilities (`{ commands: true, agents: true, mcp: true, instructions: true, skills: true }`). There's no runtime enforcement — bad output is silently produced for unsupported combos.

**vsync approach** (`adapters/codex.ts:28-34`): Codex adapter returns `agents: false, commands: false` and throws `NotSupportError` at the adapter level for unsupported operations.

**Action**: Add error type guards (`isSyncError()`, `isNotSupportError()`, `shouldRollback()`) from vsync's `utils/errors.ts:186-243`. Enforce capabilities in adapters. This is especially relevant now that Codex agents have a completely different format (see Part 2).

#### 5. Dedicated MCP Server Hash

**Problem**: acsync hashes raw JSON strings for MCP config, which is key-order-dependent. Two semantically identical configs with different key ordering produce different hashes.

**vsync approach** (`utils/hash.ts:83-122`): `hashMCPServer()` builds a stable config object, sorts keys for each nested object (headers, auth, env), then stringifies.

**Action**: Implement as part of item 1 above.

#### 6. Error Type Guards

**Problem**: acsync catches errors by `instanceof` class checks. No composable helpers for error classification.

**vsync approach** (`utils/errors.ts:186-243`): Static factory methods (`SyncError.warning()`, `.recoverable()`, `.fatal()`), type guards (`isSyncError()`, `isNotSupportError()`), and helpers (`shouldRollback()`, `getErrorSeverity()`). Also `Error.captureStackTrace` in all constructors.

**Action**: Add static factories and type guards to `src/errors.ts`.

### Medium Priority (robustness)

| # | Feature | vsync Reference | Action |
|---|---------|----------------|--------|
| 7 | `TargetStatus.synced` + `error` fields | `types/manifest.ts:17-26` | Extend `TargetStatus` in `src/types.ts` |
| 8 | `findFirstExistingPath()` for OpenCode `.json`/`.jsonc` | `utils/file-ops.ts:202-211` | Add to path resolver or file-ops |
| 9 | Env var transformer: two-pass for OpenCode | `utils/env-var-transformer.ts:142-146` | Fix `fromOpenCode()` to handle `${env:VAR}` -> `{env:VAR}` first |
| 10 | Plan validation thresholds | `core/planner.ts:287-339` | Warn on >50 ops or >10 deletes in push |

### Low Priority (nice-to-have)

- `Error.captureStackTrace` in all custom error constructors
- Debug logger with sensitive data redaction
- Benchmark utilities
- Zod runtime validation for manifest/config

### Explicitly NOT Borrowing

- **Read/write adapter pattern** — acsync's render pattern (pure functions) is better for its use case
- **`.vsync.json` config file** — canonical directory convention is simpler
- **Parallel sync orchestrator** — overkill for 4 sequential targets
- **File cache / incremental reader** — configs are small
- **`init`/`status`/`list`/`clean`/`import` commands** — existing command set covers the workflow
- **`SyncUI` service class** — JSON-default output is better for automation
- **snake_case naming** — keep camelCase consistency
- **i18n** — not needed for a personal tool
- **Symlink mode** — not needed; direct file writes are simpler
- **Cursor adapter** — not a target CLI for this user

---

## Part 2: Codex Multi-Agent Integration

### Discovery

Codex now supports multi-agent workflows via `[agents]` TOML config in `config.toml`. Docs: https://developers.openai.com/codex/multi-agent/

Feature is experimental, enabled via:
```toml
[features]
multi_agent = true
```

### Codex Agent Format (official)

Agent roles are defined in `[agents.<name>]` tables within `~/.codex/config.toml`:

```toml
[agents.reviewer]
description = "Find security, correctness, and test risks in code."
config_file = "agents/reviewer.toml"
```

Each role references a companion TOML config file (e.g., `~/.codex/agents/reviewer.toml`):

```toml
model = "gpt-5.3-codex"
model_reasoning_effort = "high"
developer_instructions = "Focus on high priority issues..."
```

#### Schema

| Field | Type | Required | Purpose |
|---|---|---|---|
| `agents.max_threads` | number | No | Max concurrent agent threads |
| `agents.<name>.description` | string | No | Role guidance shown to Codex |
| `agents.<name>.config_file` | string (path) | No | Path to TOML config layer for that role |

Built-in roles: `default`, `worker`, `explorer`. User-defined roles override built-ins.

### Current acsync Implementation (WRONG)

`src/adapters/codex.ts:51-72` renders agents as flat markdown in `~/.codex/prompts/`:
```
# Agent: {name}
**Role**: {description}
**Allowed Tools**: tool1, tool2
{body}
```

**Problems:**
1. `~/.codex/prompts/` is for slash commands, not agents
2. Codex doesn't recognize `agent-*.md` files as agents
3. The `agent-` prefix disambiguation hack conflates agents and commands in the same directory
4. Format is completely wrong (markdown vs TOML config entries)

### Canonical Agent -> Codex Agent Mapping

| Canonical Field | Codex Equivalent | Notes |
|---|---|---|
| `name` | `[agents.<name>]` table key | Direct map |
| `metadata.description` | `agents.<name>.description` | Direct map |
| `metadata.allowed-tools` | No equivalent | Codex has no per-agent tool restriction — drop silently |
| `content` (body) | `developer_instructions` in companion `.toml` | String, not markdown |
| `metadata.model` | `model` in companion `.toml` | New metadata field for Codex |
| `metadata.model_reasoning_effort` | `model_reasoning_effort` in companion `.toml` | New metadata field for Codex |
| `metadata.sandbox_mode` | `sandbox_mode` in companion `.toml` | New metadata field for Codex |

### Required Changes

#### 1. Update `renderAgent()` to produce companion TOML file

Current: returns `RenderedFile` with markdown content → `~/.codex/prompts/agent-{name}.md`

New: returns `RenderedFile` with TOML content → `~/.codex/agents/{name}.toml`

```toml
# Content of ~/.codex/agents/{name}.toml
developer_instructions = "The full agent body/content from canonical item"
# Optional fields if present in canonical metadata:
# model = "gpt-5.3-codex"
# model_reasoning_effort = "high"
# sandbox_mode = "read-only"
```

#### 2. Merge agent entries into `config.toml` alongside MCP

The `[agents]` section lives in `config.toml` next to `[mcp_servers]`. Extend `renderMCPServers()` or add a new method to also write:

```toml
[agents.my-planner]
description = "Role description"
config_file = "agents/my-planner.toml"
```

**Architecture option**: Rename `renderMCPServers()` → `renderConfigToml()` for Codex adapter, producing both `[mcp_servers]` and `[agents]` sections in one pass. Other adapters keep `renderMCPServers()` unchanged.

Alternatively, add `renderAgentConfig(): string` to the Codex adapter that returns the TOML `[agents]` section, and have the orchestrator merge both into `config.toml`.

#### 3. Update path resolver (`src/adapters/path-resolver.ts`)

```
- getAgentsDir() for codex: ~/.codex/prompts/   →   ~/.codex/agents/
- agentFileName() for codex: agent-{name}.md    →   {name}.toml
```

#### 4. Update `parseAgent()` for reverse sync (pull)

Read `config.toml` `[agents]` section to discover roles, then read companion `.toml` files for content. Return `CanonicalItem` with `developer_instructions` as `content` and config fields as metadata.

#### 5. Remove `agent-` prefix disambiguation

Since agents move out of `prompts/`, drop:
- `commandNameFromFile()` filter for `agent-` prefix (`codex.ts:26-28`)
- `agentNameFromFile()` `agent-` stripping (`codex.ts:33-36`)

#### 6. Update `listExistingAgentNames()` / `agentNameFromFile()`

Read from `~/.codex/agents/*.toml` instead of scanning `prompts/` for `agent-*.md`.

### Interface Impact

The `ToolAdapter` interface (`src/adapters/base.ts`) currently expects `renderAgent()` to return a single `RenderedFile`. For Codex, we need two writes (companion file + config.toml entry).

**Recommended approach**: Keep `renderAgent()` returning the companion `.toml` file as the `RenderedFile`. Add a separate method (or extend `renderMCPServers()`) for the config.toml `[agents]` entries. The orchestrator already handles config.toml writes for MCP; piggyback on that flow.

---

## Verification Criteria

- [ ] `acsync check` detects drift using metadata-aware hashes
- [ ] `acsync push` for Codex agents writes `[agents]` TOML entries to `config.toml`
- [ ] `acsync push` for Codex agents writes companion `.toml` files to `~/.codex/agents/`
- [ ] `acsync pull` for Codex reads agent roles from TOML config and companion files
- [ ] `acsync push --delete` removes stale agents from both `config.toml` and `agents/` dir
- [ ] No `agent-*.md` files are written to `~/.codex/prompts/`
- [ ] 3-way diff correctly identifies independent target modifications
- [ ] Existing tests pass; new tests cover Codex agent TOML rendering
- [ ] `acsync render --type agent --target codex` shows correct TOML output

## Progress Log

- 2026-02-23: Research complete. vsync comparison + Codex multi-agent docs reviewed. Plan written.
