# Coding Conventions

**Analysis Date:** 2026-02-19

## Naming Patterns

**Files:**
- Markdown files: `kebab-case.md` throughout (e.g., `zz-gate.md`, `zz-planner.md`, `browser-tools.ts`)
- All slash commands prefixed with `zz-` (e.g., `zz-gate.md`, `zz-plan.md`, `zz-verify.md`)
- All agent definitions prefixed with `zz-` (e.g., `zz-planner.md`, `zz-verifier.md`, `zz-test-writer.md`)
- JSON configs: `kebab-case.json` (e.g., `chrome-devtools-mcp.json`, `context7.json`)
- Python scripts: `kebab-case.py` (e.g., `generate-docs.py`)
- Shell scripts: no extension (e.g., `scripts/committer`)
- Skills directories: `kebab-case/` with `SKILL.md` entry point

**Functions (TypeScript):**
- `camelCase` for all functions: `browserURL()`, `connectBrowser()`, `getActivePage()`, `fetchJson()`
- `camelCase` for local variables: `pageResults`, `cssWidth`, `formatTimestamp`
- Async functions prefixed naturally (no `async` in name): `async function connectBrowser()`

**Functions (Python):**
- `snake_case` for functions: `parse_doc_frontmatter()`, `walk_docs()`
- `UPPER_SNAKE_CASE` for module constants: `REPO_ROOT`, `DOCS_DIR`, `EXCLUDED_DIRS`

**Functions (Bash):**
- `snake_case` for functions: `run_git_commit()`
- `snake_case` for variables: `commit_message`, `force_delete_lock`, `last_commit_error`

**Types (TypeScript):**
- `PascalCase` for interfaces: `ChromeProcessInfo`, `ChromeTabInfo`, `ChromeSessionDescription`
- `PascalCase` for type aliases: `AsyncFunctionCtor`

**Constants (TypeScript):**
- `UPPER_SNAKE_CASE` for module-level constants: `DEFAULT_PORT`, `DEFAULT_PROFILE_DIR`, `DEFAULT_CHROME_BIN`

**Markdown doc titles:**
- Commands: `# /zz-{name} — {Short Description}` (e.g., `# /zz-gate — Full CI Gate`)
- Agents: Use `### Role` as the primary heading after frontmatter
- Docs: `# {Title}` (plain, no prefix)

**Config identifiers:**
- MCP server names: `kebab-case` (e.g., `chrome-devtools-mcp`, `sequential-thinking`)
- Frontmatter keys: `kebab-case` (e.g., `allowed-tools`, `argument-hint`, `read_when`)
- JSON keys: `camelCase` for settings (e.g., `browserURL`, `defaultViewport`), `snake_case` or `kebab-case` for config (e.g., `env_vars`, `disabled_for`)

## Code Style

**Formatting:**
- No dedicated formatter configured (no Prettier, no ESLint, no Biome config files)
- No `tsconfig.json` — TypeScript is compiled via `bun build` directly
- Consistent 2-space indentation in TypeScript
- 4-space indentation in Python
- Single quotes for TypeScript strings
- Double quotes for Python strings (f-strings use double quotes)

**Linting:**
- No linting tools configured for this repo
- Code quality enforced by convention via `AGENTS.md` rules, not automated tooling
- Key rules from `AGENTS.md`:
  - No `any` or `as` in TypeScript (guideline; `scripts/browser-tools.ts` uses `any` in some places for Puppeteer interop)
  - Strong types, type hints everywhere in Python
  - No mocks in tests
  - Keep files <~500 LOC

**Line Length:**
- No explicit limit enforced
- TypeScript lines can be long (some exceed 120 chars in `scripts/browser-tools.ts`)
- Python stays under ~100 chars naturally

## Import Organization

**TypeScript (`scripts/browser-tools.ts`):**
1. External packages first: `import { Command } from 'commander'`
2. Node built-in modules (with `node:` prefix): `import { execSync } from 'node:child_process'`
3. No path aliases — direct relative imports

**Order within Node built-ins:**
- `node:child_process`, `node:fs/promises`, `node:http`, `node:os`, `node:path`, `node:readline/promises`, `node:process`, `node:util`
- Alphabetical by module name

**Python (`scripts/generate-docs.py`):**
1. Standard library: `import sys`, `from pathlib import Path`
2. No third-party imports in current Python scripts
3. No path aliases

## Error Handling

**TypeScript patterns:**
- `try/catch` with `finally` for cleanup (browser disconnect): consistently used in all command actions
- Empty `catch` blocks for best-effort operations: `catch { /* ignore */ }` or `catch { // ignore }`
- Type-safe error extraction: `error instanceof Error ? error.message : String(error)`
- Process exit for fatal errors: `process.exit(1)` with descriptive stderr message
- `.catch(() => {})` or `.catch(() => undefined)` for non-critical async ops (navigation timeouts)

```typescript
// Standard pattern: try/finally with browser disconnect
const { browser, page } = await getActivePage(port);
try {
  // ... do work ...
} finally {
  await browser.disconnect();
}
```

```typescript
// Error message extraction pattern
const message = error instanceof Error ? error.message : String(error);
```

**Python patterns:**
- Early returns on error with `sys.exit(1)`
- Explicit error strings in return tuples: `return None, [], "missing front matter"`

**Bash patterns:**
- `set -euo pipefail` at top of all scripts
- Explicit error messages to stderr: `printf 'Error: ...\n' >&2`
- Guard clauses with `usage()` function
- Exit codes: `exit 1` for errors, `exit 2` for usage errors

## Logging

**Framework:** `console` (no logging library)

**Patterns:**
- Success indicators: `✓` prefix (e.g., `console.log('✓ Chrome listening on...')`)
- Failure indicators: `✗` prefix (e.g., `console.error('✗ Failed to start Chrome...')`)
- `console.log()` for normal output to stdout
- `console.error()` for errors to stderr
- `console.warn()` for warnings
- Python: `print()` to stdout, `print(..., file=sys.stderr)` for errors

## Comments

**When to Comment:**
- Block comments (`/** ... */`) for module-level documentation (top of `browser-tools.ts`)
- Inline comments for non-obvious logic: `// ignore missing processes`
- Empty catch blocks always get a comment: `// ignore`, `// best-effort; continue`
- No JSDoc/TSDoc on individual functions (functions are self-documenting via names + types)

**AGENTS.md rule:** "No breadcrumbs. Delete/move code = no residual comments. No `// moved to X`. Just remove."

## Function Design

**Size:**
- Functions kept reasonably small (10–40 lines typical)
- One large file allowed: `scripts/browser-tools.ts` at 1045 lines (CLI with many subcommands)
- `AGENTS.md` guideline: keep files <~500 LOC; split/refactor as needed

**Parameters:**
- TypeScript: destructured options objects for complex params
- Named parameters preferred over positional for >2 args
- Default values via `const DEFAULT_*` constants

**Return Values:**
- TypeScript: explicit return types not always annotated (inferred by TS)
- Python: explicit return type annotations via `-> type` syntax
- Tuple returns in Python for multi-value: `tuple[str | None, list[str], str | None]`

## Module Design

**Exports:**
- TypeScript: no explicit exports in `browser-tools.ts` (CLI entry point, not a library)
- Python: no `__all__`; scripts are standalone entry points

**Barrel Files:**
- Not used (repo has no `index.ts` barrel files)

## Markdown Document Conventions

**Frontmatter (commands):**
```yaml
---
description: Short description of the command.
argument-hint: [arg-name]
allowed-tools: [Read, Glob, Grep, Bash]
---
```

**Frontmatter (agents):**
```yaml
---
name: zz-agent-name
description: One-line description of the agent's purpose.
allowed-tools: [Read, Glob, Grep, Edit, Write, Bash]
---
```

**Frontmatter (docs):**
```yaml
---
summary: "One-line summary for catalog."
read_when:
  - "Trigger condition 1"
  - "Trigger condition 2"
---
```

**Body conventions:**
- First line after frontmatter: `READ ~/Repos/acsync/AGENTS.md BEFORE ANYTHING ELSE.` (commands) or `READ ~/Repos/acsync/AGENTS.md BEFORE ANYTHING (skip if missing).` (agents)
- Sections use `##` and `###` headings
- Procedure steps numbered: `### Step 1 — Description`
- Anti-patterns listed in tables
- Output contracts show exact expected format in fenced code blocks
- Success criteria as checkbox lists: `- [ ] Criterion`

**MCP config JSON:**
```json
{
  "description": "Human-readable description",
  "transport": "stdio",
  "command": "...",
  "args": ["..."],
  "env_vars": ["VAR"],
  "env": { "KEY": "${VAR}" }
}
```

## Git Conventions

**Commits:**
- Conventional Commits format: `feat|fix|refactor|build|ci|chore|docs|style|perf|test`
- Use `committer` helper: `committer "commit message" file1 file2 ...`
- Never stage entire repo (`.` disallowed by `scripts/committer`)
- Commit message: concise, focuses on "why" not "what"

**Branches:**
- No branching conventions documented for this repo specifically
- Changes are typically direct to main

---

*Convention analysis: 2026-02-19*
