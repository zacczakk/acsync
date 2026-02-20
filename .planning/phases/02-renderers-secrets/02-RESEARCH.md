# Phase 2: Renderers + Secrets - Research

**Researched:** 2026-02-20
**Domain:** Config rendering (4 CLI targets) + secret injection + env var format conversion
**Confidence:** HIGH

## Summary

Phase 2 builds the rendering layer that transforms canonical configs (commands, agents, MCP servers, instructions, skills) into 4 target-specific formats (Claude Code, OpenCode, Gemini, Codex). The vsync codebase at `~/Repos/oss/vsync/cli/src/` provides battle-tested adapter patterns to port. Phase 1 already delivers format parsers (markdown, JSON, JSONC, TOML), atomic write, backup, hashing, and exclusion filtering — all pure string-in/string-out.

The core porting task: adapt vsync's `BaseAdapter` class hierarchy and `EnvVarTransformer` into renderer functions that accept parsed canonical objects and return rendered strings. vsync's adapters combine read+write+delete+file-I/O; our design strips that down to pure render functions (caller handles I/O via Phase 1 infra).

**Primary recommendation:** Port vsync's proven serialization logic method-by-method into pure render functions. Keep EnvVarTransformer as a class (static methods, no instances needed). Add Gemini and Codex command/agent renderers that vsync doesn't have. Use Bun's built-in `.env` loading for secrets — no external dotenv dependency.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### vsync borrowing boundaries
- Adopt vsync's normalized interchange models directly: `BaseItem` (name, content, metadata, hash, supportFiles) and `MCPServer` (type, command, args, url, env, auth)
- Port `EnvVarTransformer` as a class (not flattened to functions) — keep vsync's instance method pattern (toOpenCode(), toClaude(), normalize())
- Port adapter classes from vsync — bring over the BaseAdapter/ToolAdapter class hierarchy, not just extracted transform functions
- Include `PathResolver` (centralized path construction) and `AdapterCapabilities` (per-target feature matrix)
- Exclude: AdapterRegistry (plugin system), rollback, parallel sync, i18n — none needed for 4 fixed targets
- General principle: port vsync's proven logic; do NOT re-derive what vsync already solved

#### Secret handling behavior
- Missing `.env` file: warn and leave `${VAR}` placeholders intact in rendered output
- Missing individual variable in `.env`: warn per variable, leave that placeholder unresolved
- `.env` location: canonical repo root only (`~/Repos/agents/.env`) — no CWD search, no `--env` flag
- Redaction in output: secret values shown as `****` in dry-run/diff output (not placeholder names, not raw values)

#### Renderer function signatures
- Adapters receive parsed canonical objects (typed), not raw file paths — caller handles file I/O
- Adapter write methods return rendered string content — caller handles atomic write + backup via Phase 1 infra
- MCP renderer takes full server list and produces complete settings file (not one server at a time)
- Path expansion (`~/` -> absolute) happens inside the renderer — output is write-ready, no post-processing
- Instructions renderer concatenates AGENTS.md + CLI-specific addendum with path expansion applied

#### Codex adapter gaps
- Implement ALL Codex renderers (commands, agents, MCP) — full coverage across all 4 targets, no gaps
- Codex command/agent formats: trust prior patterns from sync script (flat markdown, `# /name` heading). No re-verification needed
- Codex MCP: port vsync's TOML serialization as-is (env_vars array, bearer_token_env_var, HTTP-only with stdio skip)

### Claude's Discretion
- Exact adapter class structure (how much of BaseAdapter to port vs simplify)
- Test strategy for renderers (snapshot tests, assertion-based, or both)
- File organization within `src/` (adapters/, renderers/, etc.)
- How to handle edge cases in frontmatter round-tripping

### Deferred Ideas (OUT OF SCOPE)
- MCPorter: Full MCP management tool
- Rollback: Port vsync's rollback infrastructure for Phase 3
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RNDR-01 | Render command → Claude Code (strip `zz-` prefix, nest `zz/` subdir, body verbatim) | vsync ClaudeCodeAdapter `writeCommands` via BaseAdapter — strip prefix + subdirectory nesting is custom (not in vsync) |
| RNDR-02 | Render command → OpenCode (rebuild frontmatter, `allowed-tools` → `tools` map, keep `zz-` prefix) | vsync OpenCodeAdapter pattern — frontmatter rebuild via gray-matter `stringify`, tool map transform is custom |
| RNDR-03 | Render command → Gemini (TOML, `prompt = """..."""`) | No vsync Gemini adapter — derived from rendered examples at `~/.gemini/commands/` |
| RNDR-04 | Render command → Codex (flat markdown, `# /{name}` heading) | No vsync Codex command support (capabilities.commands=false) — derived from rendered examples at `~/.codex/prompts/` |
| RNDR-05 | Render agent → Claude Code (nest `zz/` subdir, body verbatim) | vsync ClaudeCodeAdapter `writeAgents` via BaseAdapter — subdirectory nesting is custom |
| RNDR-06 | Render agent → OpenCode (rebuild frontmatter, add `mode: subagent`) | Custom frontmatter injection — `mode: subagent` added, `allowed-tools` stripped or remapped |
| RNDR-07 | Render agent → Gemini (add `kind: local` to frontmatter) | Custom frontmatter injection — `kind: local` added to existing metadata |
| RNDR-08 | Render agent → Codex (flat markdown, `# Agent: {name}` heading) | No vsync Codex agent support — derived from rendered examples at `~/.codex/prompts/agent-*.md` |
| RNDR-09 | Render MCP → Claude Code (JSON, `mcpServers` key, inject secrets) | vsync `ClaudeCodeAdapter.writeMCPServers` — direct port + secret injection layer |
| RNDR-10 | Render MCP → OpenCode (JSONC, `mcp` key, `local`/`remote`, `environment`, command array) | vsync `OpenCodeAdapter.writeMCPServers` — direct port with JSONC comment preservation |
| RNDR-11 | Render MCP → Gemini (JSON, `mcpServers` key, inject secrets) | Same structure as Claude Code MCP — `mcpServers` key, confirmed from `~/.gemini/settings.json` |
| RNDR-12 | Render MCP → Codex (TOML, `mcp_servers`, HTTP-only, skip stdio) | vsync `CodexAdapter.writeMCPServers` — direct port with env_vars/bearer_token_env_var logic |
| RNDR-13 | Render instructions (concat AGENTS.md + CLI addendum) | String concatenation + path expansion — trivial |
| RNDR-14 | Copy skill dirs verbatim | vsync `BaseAdapter.writeSkills` via `writeDirectoryItems` — recursive copy with support files |
| SECR-01 | Load secrets from `.env` | Bun built-in `.env` loading — no external dep needed |
| SECR-02 | Inject secrets into rendered configs | Regex `${VAR}` replacement post-render — vsync doesn't do this (it preserves placeholders) |
| SECR-03 | Convert env var syntax per target | vsync `EnvVarTransformer` — direct port (static class, format-aware conversion) |
</phase_requirements>

## Standard Stack

### Core (already in package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| gray-matter | ^4 | Frontmatter parse/stringify | Used by vsync, already in Phase 1 |
| jsonc-parser | ^3.3 | JSONC read/modify/applyEdits with comment preservation | Used by vsync for OpenCode, already in Phase 1 |
| smol-toml | ^1.6 | TOML parse/stringify (1.1 spec) | Already in Phase 1, replaces @iarna/toml |

### Supporting (no new deps needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Bun built-in | - | `.env` file loading | SECR-01: `Bun.env` auto-loads from `.env` files |
| node:path | - | Path resolution, `join`, `resolve` | PathResolver, `~` expansion via `os.homedir()` |
| node:os | - | `homedir()` for `~` expansion | Renderer path expansion |
| node:fs/promises | - | `readFile` for loading canonical source files | Caller-side I/O (not inside renderers) |

### No New Dependencies
No new npm packages required. Bun natively loads `.env` files — confirmed via Context7 docs. The `dotenv` package is unnecessary.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bun built-in `.env` | `dotenv` package | Extra dep; Bun auto-loads `.env` already, but we need explicit path loading (`~/Repos/agents/.env`) |

**Note on `.env` loading:** Bun auto-loads `.env` from CWD, but the user locked `.env` location to repo root only (`~/Repos/agents/.env`). When CLI runs from a different CWD, we need to explicitly read the `.env` file with `Bun.file()` and parse it ourselves (simple `KEY=VALUE` line parsing), OR use `--env-file` flag. A tiny custom parser (~15 lines) is safer than relying on CWD being correct. No external dep needed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── adapters/              # Per-target adapter classes (ported from vsync)
│   ├── base.ts            # BaseAdapter + ToolAdapter interface + AdapterCapabilities
│   ├── claude-code.ts     # Claude Code adapter
│   ├── opencode.ts        # OpenCode adapter
│   ├── gemini.ts          # Gemini adapter (NEW — not in vsync)
│   ├── codex.ts           # Codex adapter
│   └── path-resolver.ts   # AdapterPathResolver class
├── secrets/               # Secret loading + injection
│   ├── env-loader.ts      # Load .env file, return Record<string, string>
│   ├── injector.ts        # Replace ${VAR} placeholders with values
│   └── env-var-transformer.ts  # EnvVarTransformer class (ported from vsync)
├── types.ts               # BaseItem, MCPServer, canonical models (extend existing)
├── errors.ts              # (existing) — add SecretError if needed
├── formats/               # (existing Phase 1) — pure parsers
│   ├── json.ts
│   ├── jsonc.ts
│   ├── markdown.ts
│   └── toml.ts
└── infra/                 # (existing Phase 1) — atomic write, backup, hash, exclusion
    ├── atomic-write.ts
    ├── backup.ts
    ├── exclusion.ts
    └── hash.ts
```

### Pattern 1: Adapter Class Hierarchy (Port from vsync)

**What:** Abstract `BaseAdapter` with per-target subclasses. Each adapter knows how to render commands, agents, MCP servers, instructions, and skills for its target format.

**When to use:** All rendering operations.

**Key simplification from vsync:** vsync's BaseAdapter does file I/O (read/write/delete). Ours returns rendered strings only. The caller handles file I/O via Phase 1 infra (atomicWrite, backupFile).

```typescript
// Simplified from vsync — render-only, no I/O
export interface ToolAdapter {
  readonly toolName: TargetName;
  readonly displayName: string;

  getCapabilities(): AdapterCapabilities;

  // Render methods — return string content, caller handles I/O
  renderCommand(command: Command): RenderedFile;
  renderAgent(agent: Agent): RenderedFile;
  renderMCPServers(servers: MCPServer[]): string;
  renderInstructions(agentsMd: string, addendum: string): string;

  // Path helpers — where to write rendered files
  getCommandPath(command: Command): string;  // relative to target base
  getAgentPath(agent: Agent): string;
  getMCPConfigPath(): string;
  getInstructionsPath(): string;
  getSkillsDir(): string;
}

interface RenderedFile {
  relativePath: string;  // where to write (relative to target config dir)
  content: string;       // rendered content
}
```

### Pattern 2: EnvVarTransformer (Direct Port from vsync)

**What:** Static class with `transform(value, from, to)` method. Normalizes through Claude Code format (`${VAR}`) as intermediate. Handles string, array, object recursion.

**Port as-is from:** `vsync/cli/src/utils/env-var-transformer.ts`

**Modifications:**
- Add `"gemini"` format (same as `"claude-code"` — both use `${VAR}`)
- Remove `"cursor"` format (not a target for this project)
- Add `"codex"` format: env vars referenced by name only in `env_vars` array, not as `${VAR}` strings

```typescript
export type EnvVarFormat = "claude-code" | "opencode" | "gemini" | "codex";

export class EnvVarTransformer {
  static transform(value: unknown, from: EnvVarFormat, to: EnvVarFormat): unknown;
  static toOpenCode(value: unknown): unknown;   // claude-code → opencode
  static fromOpenCode(value: unknown): unknown;  // opencode → claude-code
  // Gemini uses same format as claude-code, so no special converter needed
}
```

### Pattern 3: Secret Injection Pipeline

**What:** Three-stage pipeline: load → inject → render.

```
1. loadSecrets("~/Repos/agents/.env") → Record<string, string>
2. For each rendered config string:
   injectSecrets(rendered, secrets) → string (replaces ${VAR} with value)
3. For dry-run display:
   redactSecrets(rendered, secrets) → string (replaces values with ****)
```

**Implementation:**
```typescript
// env-loader.ts
export function loadSecrets(envPath: string): Record<string, string> {
  // Parse KEY=VALUE lines, handle quotes, skip comments
  // Warn if file missing (don't throw)
  // Return empty record if file not found
}

// injector.ts
export function injectSecrets(
  content: string,
  secrets: Record<string, string>,
): { result: string; warnings: string[] } {
  // Replace ${VAR_NAME} with secret value
  // Collect warnings for unresolved placeholders
  // Leave ${VAR} intact if VAR not in secrets
}

export function redactSecrets(
  content: string,
  secrets: Record<string, string>,
): string {
  // Replace actual secret values with ****
}
```

### Pattern 4: Canonical MCP Config Schema

The canonical MCP config files in `configs/common/mcp/*.json` have this shape:

```json
{
  "description": "Human description",
  "transport": "stdio" | "http",
  "command": "npx",              // stdio only
  "args": ["-y", "pkg"],         // stdio only
  "url": "https://...",          // http only
  "headers": { "KEY": "${VAR}" },// http only (secrets as placeholders)
  "env_vars": ["VAR_NAME"],      // which env vars are needed
  "env": { "KEY": "${VAR}" },    // env vars to pass (secrets as placeholders)
  "disabled_for": ["codex"]      // optional: skip for specific targets
}
```

This maps to vsync's `MCPServer` model. The `disabled_for` field is project-specific (not in vsync) — adapters check it to skip servers.

### Anti-Patterns to Avoid

- **Don't mix I/O into renderers.** vsync couples read/write/delete into adapters. We decouple: adapters render strings, caller does I/O. This makes testing trivial (no fs mocking).
- **Don't build a registry.** vsync has `AdapterRegistry` for plugin discovery. With 4 fixed targets, a simple map or switch suffices.
- **Don't re-derive format rules.** The rendered examples at `~/.claude/`, `~/.config/opencode/`, `~/.gemini/`, `~/.codex/` are ground truth. Port logic from vsync + validate against these artifacts.
- **Don't use `as` casts.** Phase 1 established the pattern: proper types, no `any`, no `as`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Env var format conversion | Custom regex per adapter | `EnvVarTransformer` (port from vsync) | 3 formats, recursive object traversal, reserved var handling — vsync solved all edge cases |
| JSONC modification | Read → JSON.parse → mutate → JSON.stringify | `jsonc-parser` modify + applyEdits (already in Phase 1) | Preserves comments, handles insertion/deletion correctly |
| TOML serialization | Template strings | `smol-toml` stringify (already in Phase 1) | Handles nested tables, arrays, quoting correctly |
| Frontmatter round-trip | Regex-based extraction | `gray-matter` parse/stringify (already in Phase 1) | Handles YAML edge cases, delimiter detection, content separation |
| `.env` parsing | Complex parser with variable expansion | Simple KEY=VALUE line parser (~15 lines) | Our `.env` files are simple; no variable expansion needed. Bun's built-in loader works if CWD is right |
| Path `~` expansion | Manual string replace | `os.homedir()` + `path.join()` | Cross-platform correctness |

**Key insight:** vsync already solved the hard serialization problems (JSONC comment preservation, TOML nested tables, env var format conversion, MCP type inference). Port the logic, don't reinvent.

## Common Pitfalls

### Pitfall 1: Frontmatter Key Ordering / Extra Keys
**What goes wrong:** gray-matter's `stringify` may reorder keys or add unexpected whitespace compared to the original canonical file. When reading the rendered output back, extra keys (like `name` in the canonical but not expected in the target) cause hash mismatches.
**Why it happens:** gray-matter doesn't guarantee key order. Different targets expect different frontmatter keys.
**How to avoid:** Each adapter explicitly constructs the frontmatter object for its target — only include keys that target expects. Don't pass through the full canonical metadata blindly.
**Warning signs:** Diff shows "changed" files with identical semantic content but different key ordering.

### Pitfall 2: JSONC Comment Loss in OpenCode MCP
**What goes wrong:** Using `JSON.parse` → modify → `JSON.stringify` destroys comments in `opencode.jsonc`.
**Why it happens:** Standard JSON has no comment concept.
**How to avoid:** Already handled — Phase 1 has `modifyJsonc()` using `jsonc-parser` modify+applyEdits. Use it for all JSONC mutations.
**Warning signs:** User-added comments in opencode.jsonc disappear after sync.

### Pitfall 3: Secret Injection Timing
**What goes wrong:** Injecting secrets before env var format conversion corrupts the placeholders. E.g., `${VAR}` → `actual_value` → then trying to convert to `{env:VAR}` fails because the placeholder is gone.
**Why it happens:** Wrong pipeline order.
**How to avoid:** Pipeline order must be: (1) render with placeholders, (2) convert env var format per target, (3) inject secrets last. Or equivalently: render with target-format placeholders, then inject.
**Warning signs:** OpenCode configs have `{env:actual_secret_value}` instead of the actual value.

### Pitfall 4: Codex Skips stdio MCP Servers
**What goes wrong:** Rendering all MCP servers to Codex format when Codex only supports HTTP servers.
**Why it happens:** Not checking `disabled_for` or transport type.
**How to avoid:** Codex MCP renderer filters: skip servers where `transport === "stdio"` OR `disabled_for.includes("codex")`. Confirmed in vsync's `CodexAdapter` which only handles HTTP servers with `env_vars` array and `bearer_token_env_var`.
**Warning signs:** Codex config.toml has broken stdio server entries.

### Pitfall 5: Claude Command Name Stripping
**What goes wrong:** Claude commands use `zz/plan.md` (strip `zz-` prefix, nest under `zz/` subdir), but other targets keep `zz-plan.md`. Getting the prefix stripping wrong breaks Claude's command discovery.
**Why it happens:** Claude Code has a unique naming convention (no `zz-` prefix, nested subdirectory).
**How to avoid:** Claude adapter explicitly: `name.replace(/^zz-/, '')` for filename, always nest under `zz/` subdir. Other adapters: keep name as-is.
**Warning signs:** Claude commands appear as `/zz-plan` instead of `/zz:plan` or `/plan` under the `zz` namespace.

### Pitfall 6: OpenCode command frontmatter — `allowed-tools` to `tools` map
**What goes wrong:** Canonical commands have `allowed-tools: [Read, Glob, Grep]` (array). OpenCode expects these gone (or remapped). Passing through the canonical `allowed-tools` key produces invalid OpenCode command config.
**Why it happens:** OpenCode commands don't have an `allowed-tools` key in frontmatter — they use a different mechanism.
**How to avoid:** OpenCode command renderer strips `allowed-tools` from frontmatter entirely. The user-facing description stays; tool permissions are handled differently in OpenCode.
**Warning signs:** OpenCode command files have stale `allowed-tools` key that OpenCode ignores.

## Code Examples

### Example 1: Claude Code Command Rendering

Canonical input (`configs/common/commands/zz-plan.md`):
```markdown
---
description: Goal-backward task planning...
argument-hint: [goal]
allowed-tools: [Read, Glob, Grep, Edit, Write, Bash]
---

READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING...
# Plan
...
```

Claude Code output (`~/.claude/commands/zz/plan.md`):
```markdown
---
description: Goal-backward task planning...
argument-hint: [goal]
allowed-tools: [Read, Glob, Grep, Edit, Write, Bash]
---

READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING...
# Plan
...
```
- Name: `zz-plan` → strip prefix → `plan`, nest under `zz/` → `zz/plan.md`
- Content: verbatim (frontmatter preserved as-is)

### Example 2: OpenCode Agent Rendering

Canonical input (`configs/common/agents/zz-planner.md`):
```markdown
---
name: zz-planner
description: Goal-backward task planning...
allowed-tools: [Read, Glob, Grep, Edit, Write, Bash]
---

READ ~/Repos/agents/AGENTS.md...
```

OpenCode output (`~/.config/opencode/agents/zz-planner.md`):
```markdown
---
description: Goal-backward task planning...
mode: subagent
---
READ ~/Repos/agents/AGENTS.md...
```
- `name` field stripped (redundant with filename)
- `allowed-tools` stripped (OpenCode doesn't use it in agents)
- `mode: subagent` added

### Example 3: Gemini Command Rendering (TOML)

Canonical input: same `zz-plan.md` as above.

Gemini output (`~/.gemini/commands/zz-plan.toml`):
```toml
description = "Goal-backward task planning..."
prompt = """

READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING...

# Plan

...

User arguments: {args}
"""
```
- File extension: `.md` → `.toml`
- Frontmatter keys become top-level TOML keys
- Body becomes `prompt = """..."""` (triple-quoted string)
- `allowed-tools` and `argument-hint` stripped (Gemini doesn't use them)
- `{args}` appended at end of prompt for argument injection

### Example 4: Codex Command Rendering

Canonical input: same `zz-plan.md` as above.

Codex output (`~/.codex/prompts/zz-plan.md`):
```markdown
# /zz-plan

Goal-backward task planning...

READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING...

# Plan
...
```
- `# /{name}` heading at top
- Description as first paragraph (no frontmatter)
- Body follows after blank line
- `allowed-tools` and `argument-hint` stripped

### Example 5: Codex Agent Rendering

Codex output (`~/.codex/prompts/agent-zz-planner.md`):
```markdown
# Agent: zz-planner

**Role**: Goal-backward task planning...

**Allowed Tools**: Read, Glob, Grep, Edit, Write, Bash

READ ~/Repos/agents/AGENTS.md...
```
- `# Agent: {name}` heading
- `**Role**:` line with description
- `**Allowed Tools**:` line (human-readable, not machine-parsed)
- Body follows

### Example 6: OpenCode MCP Rendering (ported from vsync)

```typescript
// From vsync OpenCodeAdapter.writeMCPServers — adapted to return string
renderMCPServers(servers: MCPServer[]): string {
  let text = existingJsoncText || '{}';

  // Ensure mcp object exists
  if (!currentMcp) {
    text = modifyJsonc(text, ['mcp'], {});
  }

  for (const server of servers) {
    const config: Record<string, unknown> = {};
    config.type = server.type === 'stdio' ? 'local' : 'remote';

    if (server.command) {
      config.command = [server.command, ...(server.args ?? [])];
    }
    if (server.env) {
      config.environment = EnvVarTransformer.toOpenCode(server.env);
    }
    if (server.url) {
      config.url = server.url;
    }

    text = modifyJsonc(text, ['mcp', server.name], config);
  }

  return text;
}
```

### Example 7: EnvVarTransformer (direct port from vsync)

```typescript
// Port as-is from vsync/cli/src/utils/env-var-transformer.ts
// Only change: remove "cursor" format, add "gemini" (alias for "claude-code")

export class EnvVarTransformer {
  static transform(value: unknown, from: EnvVarFormat, to: EnvVarFormat): unknown {
    if (from === to) return value;
    if (typeof value === 'string') return this.transformString(value, from, to);
    if (Array.isArray(value)) return value.map(item => this.transform(item, from, to));
    if (value && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value)) {
        result[key] = this.transform(item, from, to);
      }
      return result;
    }
    return value;
  }

  private static toNormalized(value: string, from: EnvVarFormat): string {
    switch (from) {
      case 'claude-code':
      case 'gemini':
        return value;  // Already ${VAR}
      case 'opencode':
        return value.replace(/\{env:([A-Za-z0-9_]+)\}/g, '${$1}');
    }
  }

  private static fromNormalized(value: string, to: EnvVarFormat): string {
    switch (to) {
      case 'claude-code':
      case 'gemini':
        return value;  // Already ${VAR}
      case 'opencode':
        return value.replace(/\$\{([A-Z0-9_]+)\}/g, '{env:$1}')
                    .replace(/\$\{env:([^}]+)\}/g, '{env:$1}');
    }
  }
}
```

### Example 8: Secret Injection

```typescript
export function injectSecrets(
  content: string,
  secrets: Record<string, string>,
): { result: string; warnings: string[] } {
  const warnings: string[] = [];
  const result = content.replace(/\$\{([A-Z0-9_]+)\}/g, (match, varName) => {
    if (varName in secrets) {
      return secrets[varName];
    }
    warnings.push(`Unresolved secret: ${varName}`);
    return match; // Leave placeholder intact
  });
  return { result, warnings };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Template strings for TOML | `smol-toml` stringify | Phase 1 decision | Correct nested table handling |
| JSON.parse for JSONC | `jsonc-parser` modify+applyEdits | Phase 1 decision | Comment preservation |
| `dotenv` package | Bun built-in `.env` loading | Bun 1.0+ | No external dep for env vars |
| Per-adapter duplicate env var logic | `EnvVarTransformer` class | vsync refactor | DRY, single source of truth |

## Discretion Recommendations

### 1. Adapter Class Structure

**Recommendation: Simplified BaseAdapter — render-only, no I/O**

vsync's `BaseAdapter` is 649 lines with read/write/delete methods + file I/O. We need ~200 lines.

Port:
- `ToolAdapter` interface (simplified to render methods + path helpers)
- `BaseAdapter` abstract class (constructor, pathResolver, getCapabilities)
- `AdapterCapabilities` interface
- `AdapterPathResolver` class (as-is, 116 lines)

Skip:
- `readDirectoryItems`, `readFlatItems`, `readDirectoryBasedItems`, `readFlatFileBasedItems` — read direction not needed
- `writeItems`, `writeDirectoryItems`, `writeFlatItems` — file I/O replaced by render-only
- `deleteDirectoryItem`, `deleteFlatItem` — delete not needed in Phase 2
- `WriteResult`, `ValidationResult` — replaced by returning strings
- All `fs/promises` imports and atomicWrite usage inside adapters

Each subclass implements `renderCommand()`, `renderAgent()`, `renderMCPServers()`, `renderInstructions()`. MCP rendering methods are the most complex (port the full serialization logic from each vsync adapter). Command/agent rendering is simpler (frontmatter manipulation).

### 2. Test Strategy

**Recommendation: Snapshot tests for rendering, assertion-based for secrets/env-var-transform**

- **Snapshot tests** for each renderer: given a canonical input, the rendered output must match a known-good snapshot. This catches any format regression. Store snapshots adjacent to test files (`__tests__/__snapshots__/`).
- **Assertion-based tests** for `EnvVarTransformer`: test each format conversion with explicit expected values (already done in vsync, port the test patterns).
- **Assertion-based tests** for secret injection: test placeholder resolution, missing var warnings, redaction.
- **Round-trip tests** for frontmatter: parse → render → parse should produce identical data.

Bun's test runner (`bun:test`) already used in Phase 1. Continue using it.

### 3. File Organization

**Recommendation: `src/adapters/` for adapter classes, `src/secrets/` for secret handling**

```
src/
├── adapters/
│   ├── base.ts              # BaseAdapter, ToolAdapter, AdapterCapabilities
│   ├── claude-code.ts
│   ├── opencode.ts
│   ├── gemini.ts
│   ├── codex.ts
│   ├── path-resolver.ts     # AdapterPathResolver
│   └── __tests__/
│       ├── claude-code.test.ts
│       ├── opencode.test.ts
│       ├── gemini.test.ts
│       ├── codex.test.ts
│       └── __snapshots__/
├── secrets/
│   ├── env-loader.ts
│   ├── injector.ts
│   ├── env-var-transformer.ts
│   └── __tests__/
│       ├── env-loader.test.ts
│       ├── injector.test.ts
│       └── env-var-transformer.test.ts
├── types.ts                  # Extended with BaseItem, MCPServer, TargetName
├── errors.ts                 # (existing)
├── formats/                  # (existing Phase 1)
└── infra/                    # (existing Phase 1)
```

### 4. Frontmatter Round-Tripping Edge Cases

**Recommendation: Explicit key construction per target, not pass-through**

Each adapter builds its target's frontmatter object from scratch using only the keys that target expects:

- **Claude Code commands**: pass through all canonical keys (description, argument-hint, allowed-tools)
- **Claude Code agents**: pass through (name, description, allowed-tools) — nest under `zz/` subdir
- **OpenCode commands**: keep description; strip allowed-tools, argument-hint
- **OpenCode agents**: keep description; add `mode: subagent`; strip allowed-tools, name
- **Gemini commands**: top-level TOML (description + prompt); no frontmatter
- **Gemini agents**: keep description, allowed-tools; add `kind: local`
- **Codex commands/agents**: no frontmatter at all (flat markdown)

This avoids gray-matter round-trip issues because we never round-trip — we parse once, construct output explicitly.

## Open Questions

1. **OpenCode command `allowed-tools` → `tools` map conversion**
   - What we know: Canonical has `allowed-tools: [Read, Glob, Grep]`. OpenCode rendered commands at `~/.config/opencode/command/zz-plan.md` have no `allowed-tools` in frontmatter — it was stripped.
   - What's unclear: The requirement says "rebuild frontmatter, `allowed-tools` → `tools` map" but rendered examples show it stripped entirely. The `tools` map exists in OpenCode agents (like `gsd-phase-researcher.md`) but not in commands.
   - Recommendation: For commands, strip `allowed-tools` entirely (matches observed behavior). For agents, the `tools` map is set in the agent definition already — no conversion needed from canonical.

2. **Gemini `{args}` injection in commands**
   - What we know: Gemini TOML commands end with `User arguments: {args}` inside the prompt.
   - What's unclear: Is this always appended, or only when `argument-hint` is present in canonical?
   - Recommendation: Always append `User arguments: {args}` at the end of the prompt for Gemini commands (observed in all rendered examples). This is Gemini's mechanism for argument injection.

3. **MCP server `disabled_for` filtering**
   - What we know: Canonical MCP configs have `"disabled_for": ["codex"]`. vsync doesn't have this concept (it syncs all servers to all targets).
   - What's unclear: Should this filtering happen in the adapter's render method, or in the caller before passing servers to the adapter?
   - Recommendation: Filter in the caller, not the adapter. Keep adapters pure renderers; the orchestration layer filters the server list per target before calling `renderMCPServers()`.

## Sources

### Primary (HIGH confidence)
- vsync codebase: `~/Repos/oss/vsync/cli/src/adapters/` — all adapter implementations studied
- vsync codebase: `~/Repos/oss/vsync/cli/src/utils/env-var-transformer.ts` — EnvVarTransformer class
- vsync codebase: `~/Repos/oss/vsync/cli/src/utils/mcp-utils.ts` — MCP type inference
- vsync codebase: `~/Repos/oss/vsync/cli/src/types/models.ts` — BaseItem, MCPServer models
- Phase 1 codebase: `~/Repos/agents/src/` — existing types, errors, formats, infra
- Rendered examples: `~/.claude/commands/zz/`, `~/.config/opencode/command/`, `~/.gemini/commands/`, `~/.codex/prompts/` — ground truth for each target format
- Canonical configs: `~/Repos/agents/configs/common/` — source of truth
- Bun docs (Context7 `/oven-sh/bun`): `.env` loading behavior confirmed

### Secondary (MEDIUM confidence)
- Gemini format inference: derived from rendered examples only (no official Gemini config format docs found in vsync)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps, all already in package.json, Bun `.env` confirmed via Context7
- Architecture: HIGH — vsync codebase fully studied, adapter patterns well-understood, all 4 rendered targets verified against actual files on disk
- Pitfalls: HIGH — derived from vsync implementation patterns + observed rendered examples

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (stable domain — config formats don't change frequently)
