# Testing Patterns

**Analysis Date:** 2026-02-19

## Test Framework

**Runner:**
- No test framework configured in this repo
- No `jest.config.*`, `vitest.config.*`, `pytest.ini`, or equivalent
- No test runner in `package.json` scripts
- No `devDependencies` section in `package.json`

**Rationale (from `docs/overview.md`):**
> v1 had a 3,500 LOC Python sync engine with 6,800 LOC of tests [...] v2 replaces all of that with ~400 lines of playbook + slash commands. The agent does the work interactively. No code to maintain. No tests needed for a document.

**Run Commands:**
```bash
# No test commands available for this repo
```

## Test File Organization

**Location:**
- No test files exist anywhere in the codebase
- No `*.test.*`, `*.spec.*`, `test_*.*`, or `__tests__/` directories

**Naming:**
- Not applicable (no tests exist)

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

## Validation of This Repo

This repo (`agents`) has **no automated tests** by design. Quality is ensured through:

1. **Document validation**: `scripts/generate-docs.py` enforces front-matter on all `docs/*.md` files
2. **Drift detection**: `/zz-sync-agent-configs check` verifies system files match canonical sources
3. **Interactive sync**: Every write during push/pull requires human confirmation
4. **Agent-driven verification**: The zz-verifier agent runs when invoked, discovering available checks

The repo's `scripts/generate-docs.py` is the closest thing to a test — it validates front-matter structure and exits with code 1 on issues:

```python
if errors:
    print(f"\n{errors} file(s) with front-matter issues.", file=sys.stderr)
    sys.exit(1)
```

Run it with:
```bash
python scripts/generate-docs.py
```

---

*Testing analysis: 2026-02-19*
