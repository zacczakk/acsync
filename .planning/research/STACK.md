# Stack Research

**Domain:** Config sync CLI tool (TypeScript/Bun)
**Researched:** 2026-02-20
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Bun | >=1.2 | Runtime, package manager, bundler | Specified by project. Native TS execution, fast file I/O (`Bun.write`/`Bun.file`), built-in crypto (`Bun.CryptoHasher`), single binary. Eliminates need for separate bundler/transpiler. |
| TypeScript | ~5.7 | Type safety | Bun ships with TS support. Strict mode. No separate tsc needed at runtime. |
| commander.js | ^14.0.3 | CLI framework | 14.0.3 released Jan 2026. Most popular Node CLI framework. `@commander-js/extra-typings` provides full TS inference for `.opts()` and `.action()`. Simple API for subcommands (`sync`, `check`, `diff`). |
| Zod | ^3.25 (v4) | Schema validation | Zod 4 is stable (mid-2025). Import via `"zod/v4"`. Validates config schemas, ensures type-safe canonical format. 2.3x smaller bundle, 14x faster string parsing vs v3. |

### Format Parsers

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| jsonc-parser | ^3.3.1 | JSONC read/write with comment preservation | Microsoft/VSCode's own JSONC parser. `parseTree`/`modify`/`format` APIs allow surgical edits preserving comments + formatting. Only library that does comment-preserving modifications. Critical for Claude Code and Cursor settings files. |
| smol-toml | ^1.6.0 | TOML parse/stringify | TOML 1.1.0 compliant (Dec 2024 release). Small (~5KB), fast, zero deps. Active development (Cloudflare uses it). Used for Gemini CLI config generation. |
| gray-matter | ^4.0.3 | YAML frontmatter in markdown | 3.5M weekly downloads. Parses `---` delimited YAML frontmatter, returns `{ data, content }`, has `stringify()` for round-trip. Used for OpenCode command files and Codex markdown configs. |

### Bun Built-ins (Zero Dependencies)

| Capability | Bun API | Purpose | Notes |
|------------|---------|---------|-------|
| SHA-256 hashing | `Bun.CryptoHasher("sha256")` | Content-based diffing | Incremental `.update()`, output as hex via `.digest("hex")`. No `node:crypto` import needed. |
| File I/O | `Bun.file()` / `Bun.write()` | Read/write config files | `Bun.file(path).text()` for read, `Bun.write(path, content)` for write. Handles strings, buffers, blobs. |
| Glob | `Bun.Glob` | File discovery | Native glob for scanning config directories. |
| JSON parse/stringify | `JSON.parse` / `JSON.stringify` | Plain JSON configs | Built-in. For non-JSONC files only (no comments to preserve). |

### Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| vitest | ^4.0 | Testing | Vitest 4 released Oct 2025. Jest-compatible API, native ESM, fast watch mode. Preferred over `bun:test` for richer assertions, snapshot testing, and coverage reporting. |
| @biomejs/biome | ^1.9 | Lint + format | Single tool replaces ESLint + Prettier. Fast (Rust-based). Deterministic formatting prevents CI churn. |

## Installation

```bash
# Core dependencies
bun add commander@^14 zod@^3.25 jsonc-parser@^3.3 smol-toml@^1.6 gray-matter@^4

# TypeScript extras for commander
bun add @commander-js/extra-typings@^14

# Dev dependencies
bun add -d vitest@^4 @biomejs/biome@^1.9 @types/bun
```

## Atomic File Writes

No library needed. Standard write-to-temp-then-rename pattern:

```typescript
import { renameSync } from "node:fs";

async function atomicWrite(path: string, content: string): Promise<void> {
  const tmp = `${path}.tmp.${process.pid}`;
  await Bun.write(tmp, content);
  renameSync(tmp, path); // atomic on same filesystem
}
```

This is the POSIX-standard approach. `rename()` is atomic within the same filesystem. Adding PID to temp name prevents collisions in parallel runs.

## Env Var Interpolation

Custom implementation — no library needed. The `{env:VAR_NAME}` pattern is simple regex:

```typescript
function interpolateEnv(value: string): string {
  return value.replace(/\{env:(\w+)\}/g, (_, key) => {
    const val = process.env[key];
    if (val === undefined) throw new Error(`Missing env var: ${key}`);
    return val;
  });
}
```

No template engine overhead for a fixed pattern.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| commander.js | citty (unjs) | If building for unjs ecosystem (Nuxt/Nitro). citty is newer but smaller community. Commander has 14+ years of stability. |
| commander.js | yargs | If you need very complex argument parsing with middleware. Heavier API surface than needed here. |
| Zod 4 | TypeBox | If bundle size is absolutely critical (TypeBox compiles to JSON Schema). Zod's DX and ecosystem win for config validation. |
| smol-toml | @iarna/toml | If you need TOML 0.5 compat specifically. @iarna/toml 3.0 exists but smol-toml is more actively maintained and TOML 1.1 compliant. |
| gray-matter | front-matter (npm) | gray-matter has more features (stringify, custom engines). front-matter is read-only. We need round-trip. |
| vitest | bun:test | If you want zero dev deps for testing. bun:test is faster but lacks vitest's snapshot testing, coverage, and rich matchers. |
| Biome | ESLint + Prettier | If you need ESLint plugin ecosystem (e.g., eslint-plugin-import). Biome is faster and simpler for a new project. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@iarna/toml` | Slower, larger, last meaningful update was to bump to 3.0.0. Not TOML 1.1 compliant. | `smol-toml` |
| `cosmiconfig` | Over-engineered config loader. We know exactly where configs live (fixed paths per CLI target). No discovery needed. | Direct `Bun.file()` reads |
| `chalk` | Heavy for what we need. This CLI outputs structured data for agent consumption, not fancy terminal UI. | `picocolors` if any coloring needed (3.5KB) |
| `inquirer` / `prompts` | This is a non-interactive, deterministic sync tool. No user prompts. | Commander flags/subcommands |
| `jest` | Legacy. Slow startup, poor ESM support, complex config. | `vitest` |
| `dotenv` | Bun reads `.env` files natively. Zero config. | `Bun.env` / `process.env` |
| `fs-extra` | Bun's file APIs (`Bun.write`, `Bun.file`) cover everything. `fs-extra` adds unnecessary abstraction. | `Bun.write()` + `node:fs` for `rename`/`mkdir` |
| `JSON5` | Not needed. JSONC (JSON with Comments) is the format used by VS Code / Cursor / Claude. `jsonc-parser` handles it. JSON5 is a different spec. | `jsonc-parser` |
| `js-yaml` | Not needed directly. `gray-matter` uses it internally for frontmatter parsing. Don't add as separate dep. | `gray-matter` |
| `tomlkit` (Python) | Python library, wrong ecosystem. Mentioned because it preserves TOML comments — but we generate TOML from scratch, so no comment preservation needed. | `smol-toml` |

## Stack Patterns by Variant

**If TOML comment preservation becomes needed (e.g., user-edited Gemini configs):**
- No good JS library exists for this. Would need to: read raw TOML string, modify via string manipulation or AST, write back. `smol-toml` doesn't preserve comments. Cross that bridge if/when needed.

**If targeting Node.js instead of Bun:**
- Replace `Bun.CryptoHasher` with `node:crypto.createHash`
- Replace `Bun.write`/`Bun.file` with `node:fs/promises`
- Replace `Bun.Glob` with `globby` or `fast-glob`
- Add `tsx` or `ts-node` for TS execution
- Everything else stays the same

**If output needs rich terminal formatting:**
- Add `picocolors@^1.1` (3.5KB, zero deps) for ANSI colors
- Add `cli-table3@^0.6` for tabular diff output
- Keep structured JSON output as primary (machine-readable)

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| commander@14 | @commander-js/extra-typings@14 | Major versions must match exactly |
| zod@^3.25 (v4) | TypeScript >=5.0 | Import from `"zod/v4"` for v4 API. `"zod"` still exports v3 for backward compat. |
| smol-toml@1.6 | Bun, Node 18+ | Pure JS, no native deps. Works everywhere. |
| jsonc-parser@3.3 | Any JS runtime | Pure JS. Same parser VS Code uses internally. |
| gray-matter@4.0 | Any JS runtime | Uses js-yaml internally. ESM + CJS. |
| vitest@4 | Bun (via bun plugin) | Use `vitest --pool bun` or configure in vitest.config.ts |

## Key Design Decisions

### Why jsonc-parser over manual regex for JSONC?

JSONC is deceptively complex: nested comments, trailing commas, string escapes. `jsonc-parser`'s `modify()` API allows targeted edits (set a key, remove a key) that preserve surrounding comments and formatting. Rolling your own means bugs with edge cases. This is the same parser powering VS Code — battle-tested on millions of settings files.

### Why gray-matter over manual frontmatter parsing?

Frontmatter seems simple (`---\n...\n---`) but edge cases matter: YAML with `---` in values, empty frontmatter, different delimiters. gray-matter's `stringify()` is the key feature — it reassembles content + data back into a valid frontmatter document.

### Why Zod 4 over plain TypeScript types?

Config schemas need runtime validation, not just compile-time types. When reading a user's config file, you need to know if it's malformed before processing. Zod gives both: runtime `.parse()` with clear error messages + inferred TypeScript types via `z.infer<>`.

### Why Bun built-in crypto over a hashing library?

`Bun.CryptoHasher("sha256")` is a C++ binding, faster than any pure-JS implementation. SHA-256 is sufficient for content diffing (not security). No reason to add a dependency for something the runtime provides natively.

## Sources

- Context7: `/tj/commander.js` — TypeScript integration, options API, version info
- Context7: `/jonschlinkert/gray-matter` — parse/stringify API, frontmatter handling
- Context7: `/websites/zod_dev_v4` — Zod 4 stable release, migration syntax
- Context7: `/vitest-dev/vitest` — version info, Bun compatibility
- GitHub: [commander.js CHANGELOG](https://github.com/tj/commander.js/blob/master/CHANGELOG.md) — v14.0.3 (Jan 2026)
- GitHub: [smol-toml releases](https://github.com/squirrelchat/smol-toml/releases) — v1.6.0 (Dec 2024), TOML 1.1.0
- NPM: jsonc-parser — v3.3.1, Microsoft/VSCode parser
- NPM: gray-matter — v4.0.3, 3.5M weekly downloads
- Bun Docs: [Hashing](https://bun.com/docs/runtime/hashing) — CryptoHasher SHA-256 API
- Snyk: vitest — v4.0.18 latest (Feb 2026)
- InfoQ: [Zod v4](https://www.infoq.com/news/2025/08/zod-v4-available/) — stable release coverage

---
*Stack research for: config-sync CLI tool (TypeScript/Bun)*
*Researched: 2026-02-20*
