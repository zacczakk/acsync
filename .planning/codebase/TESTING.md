# Testing Patterns

**Updated:** 2026-02-25

## Test Framework

**Runner:** Bun's built-in test runner (`bun:test`)

**Run Commands:**
```bash
bun test                          # Full suite (unit + E2E)
bun test test/__tests__/          # E2E tests only
bun test src/                     # Unit tests only
bun test test/__tests__/pull-mcp.test.ts  # Single file
```

## Test File Organization

**Location:**
- Unit tests: colocated at `src/**/__tests__/*.test.ts`
- E2E tests: `test/__tests__/*.test.ts`
- Fixtures: `test/fixtures/` (canonical/, claude/, opencode/, gemini/, codex/, seeds/)
- Helpers: `test/helpers/backup.ts`

**Naming:** `{module}.test.ts` or `{feature}-{type}.test.ts` (e.g., `push-commands.test.ts`)

## Test Philosophy (from AGENTS.md)

While this repo has no tests, it defines a **strong testing philosophy** enforced across all repos managed by these agent configs:

### Core Rules (from `AGENTS.md`)

```
- No mocks; unit or e2e. Mocks invent fake behaviors, hide real bugs.
- Test rigorously. New contributor can't break things; nothing slips by.
```

### Definition of Done by Task Type

| Task Type | Requirements |
|-----------|-------------|
| Bug fix | regression test + existing suite green + CI green |
| Feature | tests + docs updated + CI green |
| Refactor | behavior unchanged + tests pass + CI green |
| Docs | render/preview if available + links valid |

### Mock Policy (from `configs/agents/zz-test-writer.md`)

```
- NEVER mock the system under test
- NEVER mock direct dependencies (sibling modules, utility functions)
- OK to mock external services: HTTP APIs, third-party SDKs, email providers
- Prefer test databases, in-memory stores, temp files, or fixtures over data layer mocks
- If you must mock, assert the mock's interface matches the real implementation
- If the mock's setup is longer than the test, you're mocking too much
```

## Test Infrastructure via Agent System

Testing in this ecosystem is handled by **agent subagents**, not traditional test suites:

### zz-verifier Agent (`configs/agents/zz-verifier.md`)

Auto-discovers and runs CI gate for any repo. Invoked by `/zz-gate` and `/zz-verify` commands.

**Discovery order per category:**
1. `package.json` scripts
2. `Makefile` / `justfile` targets
3. CI config (`.github/workflows/*.yml`)
4. Config file heuristics (e.g., `jest.config.*` → `npx jest`)

**Execution rules:**
- Run lint → typecheck → test → build (in order)
- Continue on failure (don't abort early)
- Capture stdout/stderr and exit code per step
- Record wall-clock time per step
- Never install dependencies without user approval

**Output format:**
```markdown
| Step      | Command            | Result      | Time  |
|-----------|--------------------|-------------|-------|
| Lint      | `npm run lint`     | PASS        | 2.3s  |
| Typecheck | `npx tsc --noEmit` | PASS        | 4.1s  |
| Test      | `npm test`         | FAIL (3/47) | 12.5s |
| Build     | `npm run build`    | PASS        | 8.2s  |
```

### zz-test-writer Agent (`configs/agents/zz-test-writer.md`)

Writes tests for specified scope. Invoked by `/zz-test` command.

**Convention discovery (Step 1):**
- Read 2+ existing test files before writing any test
- Match repo's framework, naming, directory structure, assertion style, fixture patterns
- Match import style (relative vs. path aliases)

**Test design priority:**
1. Happy path (always first)
2. Error paths (invalid inputs, missing data, failure conditions)
3. Edge cases (boundary values, empty collections, unicode)
4. Integration (preferred over mocks)

**Test quality rules:**
- One concept per test
- Descriptive names: `returns empty array when no items match filter`
- Deterministic: no random data, no timing dependencies
- Independent: no shared mutable state
- Fast: unit tests <1s each
- Arrange/Act/Assert structure

**Execution requirement:**
- Always run tests after writing them
- Run full suite to check for interference
- Never mark done without execution

## Mocking

**Framework:** Determined per-repo by zz-test-writer convention discovery

**Policy (strict):**

| Dependency Type | Mock? | Alternative |
|----------------|-------|-------------|
| Pure function / internal logic | Never | Test directly |
| Database | Avoid | Test DB, in-memory store, fixtures |
| External HTTP API | OK | Only acceptable mock target |
| File system | Avoid | Temp dirs with cleanup |
| Time/randomness | Inject | Freeze/inject for determinism |

**Anti-patterns (forbidden):**
- Mocking the system under test
- Mocking direct dependencies
- Mock setup longer than the test itself
- Tautological tests that pass regardless of implementation
- Asserting on internal implementation details

## Coverage

**Requirements:** Not enforced at repo level (no coverage config)

**Per-repo guidance:** The zz-test-writer agent reports coverage as a table:

```markdown
| Target              | Happy Path | Error Paths | Edge Cases |
|---------------------|-----------|-------------|------------|
| `src/auth.ts:login` | 2 tests   | 3 tests     | 1 test     |
```

## Test Types

**Unit Tests:**
- Primary testing approach
- Test pure functions and internal logic directly
- No mocks for sibling modules
- Must complete in <1s each

**Integration Tests:**
- Preferred over mocks for multi-module flows
- Realistic data shapes matching production usage
- Verify side effects: state changes, emitted events, written files

**E2E Tests:**
- Framework determined per-repo
- Used alongside unit tests (from AGENTS.md: "No mocks; unit or e2e")

## Verification Commands (from zz-verifier)

The agent system discovers verification commands automatically. Common patterns:

```bash
# TypeScript/JS
npx tsc --noEmit          # Typecheck
npx eslint .              # Lint
npx jest                  # Test (if jest.config.* exists)
npx vitest run            # Test (if vitest.config.* exists)
npm run build             # Build

# Python
ruff check .              # Lint
mypy .                    # Typecheck
pytest                    # Test

# Go
go build ./...            # Build
go test ./...             # Test

# Rust
cargo clippy              # Lint
cargo test                # Test
cargo build               # Build
```

## E2E Test Isolation (homeDir pattern)

E2E tests exercise real push/pull pipelines but **never touch real target directories** (`~/.claude`, `~/.config/opencode`, `~/.gemini`, `~/.codex`).

**How it works:**

1. `AdapterPathResolver` accepts optional `homeDir` — redirects all `~` expansion to a temp dir
2. Threaded through: `BaseAdapter` → concrete adapters → `createAdapter(target, homeDir)` → `runPush`/`runPull`/`runCheck`
3. Each test creates an isolated fake home: `createTestHome('my-test')` returns `/tmp/acsync-home-my-test-xxxxx`
4. Target paths resolve inside the fake home (e.g., `fakeHome/.claude/commands/` instead of `~/.claude/commands/`)

**Test helpers** (`test/helpers/backup.ts`):

| Helper | Purpose |
|--------|---------|
| `createTestHome(label)` | Isolated fake `~` directory |
| `createTestProject(label, fixtureRoot)` | Temp dir with canonical fixtures in `configs/` |
| `createEmptyProject(label)` | Temp dir with empty `configs/` |
| `seedTargetFixtures(fakeHome, fixtureRoot, target, type)` | Plant push golden fixtures into fakeHome |
| `withBackup(dirs, fn)` | Generic dir backup/restore (for harness tests only) |

**Why not backup/restore:** Prior approach used `withTargetBackup` to backup real `~/.claude` etc., run tests, then restore. This failed under bun's parallel test execution — multiple files racing on the same directories caused backup/restore to clobber each other, deleting real configs. The `homeDir` approach eliminates the problem by construction.

**Coverage:** 457 tests, 1133 assertions, 42 files. 48 E2E cells (6 config types × 4 targets × push + pull). Suite runs in ~600ms.

---

*Updated: 2026-02-25*
