---
name: test-driven-development
description: >
  Red-green-refactor TDD workflow. Use when implementing features or bugfixes
  to write failing tests before implementation code. Enforces test-first
  discipline with verification at each step.
---

# Test-Driven Development

Write the test first. Watch it fail. Write minimal code to pass.

**Core principle:** If you didn't watch the test fail, you don't know if it tests the right thing.

## When to Use

- New features, bug fixes, behavior changes, refactoring
- **Exceptions (ask user):** throwaway prototypes, generated code, config files

## Red-Green-Refactor

### RED — Write Failing Test

One minimal test showing what should happen.
- One behavior per test
- Clear name describing behavior
- Real code, no mocks unless unavoidable

Run test. Confirm it **fails** (not errors) because the feature is missing.

**Test passes immediately?** You're testing existing behavior. Fix the test.

### GREEN — Minimal Code

Write the simplest code to make the test pass. Nothing more.

Run test. Confirm it passes. Confirm all other tests still pass.

**Don't** add features, refactor other code, or "improve" beyond what the test requires.

### REFACTOR — Clean Up

After green only: remove duplication, improve names, extract helpers. Keep all tests green. Don't add behavior.

### Repeat

Next failing test for the next behavior.

## Iron Rules

- **No production code without a failing test first.** Wrote code before the test? Delete it. Start over.
- **No mocks unless unavoidable.** Test real behavior. See `testing-anti-patterns.md` for details.
- **Verify at every step.** Run tests after RED (must fail), after GREEN (must pass), after REFACTOR (must stay green).

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
| "Need to explore first" | Fine. Throw away exploration, then start TDD. |
| "Test is hard to write" | Listen to the test — hard to test = hard to use. Simplify the design. |
| "TDD will slow me down" | TDD is faster than debugging. |
| "Deleting X hours of work is wasteful" | Sunk cost fallacy. Keeping unverified code is tech debt. |

## Bug Fix Pattern

1. **RED:** Write test reproducing the bug
2. **Verify:** Confirm it fails as expected
3. **GREEN:** Fix the bug (minimal change)
4. **Verify:** Test passes, all tests green
5. **REFACTOR:** Clean up if needed

Never fix bugs without a failing test first.

## Verification Checklist

Before marking work complete:
- [ ] Every new function/method has a test
- [ ] Watched each test fail before implementing
- [ ] Each test failed for expected reason (missing feature, not typo)
- [ ] Wrote minimal code to pass each test
- [ ] All tests pass with clean output
- [ ] Tests use real code (mocks only if unavoidable)
- [ ] Edge cases and errors covered
