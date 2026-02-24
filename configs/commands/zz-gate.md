---
description: Full CI gate — binary shippable/not-shippable verdict.
allowed-tools: [Read, Glob, Grep, Bash]
---

# /zz-gate — Full CI Gate

READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING ELSE. Follow all rules there. Skip if file missing.

## Purpose

Binary ship/no-ship gate. Always runs **everything** — no scoping, no shortcuts.

Unlike `/zz-verify` which can be scoped to a specific area, `/zz-gate` is always the full suite.
The output is a single verdict: **Shippable** or **Not shippable**.

## Procedure

### 1. Detect project type and available checks

Scan the repo root for project markers:
- `package.json` → Node/TS project (look for lint, typecheck, test, build scripts)
- `pyproject.toml` → Python project (look for ruff, pytest, mypy)
- `Cargo.toml` → Rust project (cargo clippy, cargo test, cargo build)
- `Package.swift` → Swift project (swift build, swift test)
- Other → adapt to what's available

### 2. Spawn zz-verifier agent in full-gate mode

Spawn a subagent (see docs/subagent.md) to run the verification suite.
Do NOT pass a scope argument — this triggers full-gate mode.

The zz-verifier must run ALL of these steps (skip if not applicable):
1. **Lint** — project linter (eslint, ruff, clippy, swiftlint, etc.)
2. **Type check** — tsc, mypy, cargo check, etc.
3. **Unit tests** — full test suite, no skips
4. **Build** — production build must succeed
5. **Docs** — if docs build exists, run it

### 3. Collect task checklist status (if applicable)

If `docs/plans/*/PLAN.md` files exist:
- Parse each for checklist items (`- [x]` and `- [ ]`)
- Count completed vs total
- Include in verdict output

### 4. Synthesize verdict

After all steps complete, produce the verdict:

**Shippable** — all steps pass, zero warnings, checklists complete (if any):
```
VERDICT: Shippable

  Lint        PASS   (1.2s)
  Typecheck   PASS   (3.4s)
  Tests       PASS   (12.1s)  42/42
  Build       PASS   (8.7s)
  Tasks       DONE   3/3 checklists complete
```

**Not shippable** — any failure blocks shipping:
```
VERDICT: Not shippable

  Lint        PASS   (1.2s)
  Typecheck   FAIL   (3.4s)  2 errors
  Tests       PASS   (12.1s)  42/42
  Build       SKIP   (blocked by typecheck)
  Tasks       WARN   1/3 checklists incomplete

Reasons:
  1. src/foo.ts:12 — Type 'string' is not assignable to type 'number'
  2. src/bar.ts:45 — Property 'x' does not exist on type 'Y'
```

Always show the pass/fail matrix with timing. List every failure reason.
