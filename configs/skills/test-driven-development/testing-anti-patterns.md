# Testing Anti-Patterns

Load when: writing or changing tests, adding mocks, or tempted to add test-only methods.

**Core principle:** Test what the code does, not what the mocks do.

## Iron Laws

1. Never test mock behavior
2. Never add test-only methods to production classes
3. Never mock without understanding dependencies

## Anti-Patterns

### 1. Testing Mock Behavior

Asserting on mock elements (`*-mock` test IDs) instead of real component behavior.

**Fix:** Test real component or don't mock it. If mocking is necessary, assert on the component's behavior with the mock present — not the mock itself.

### 2. Test-Only Methods in Production

Adding methods like `destroy()` or `reset()` to production classes just for test cleanup.

**Fix:** Move to test utilities. Production classes shouldn't know about tests.

### 3. Mocking Without Understanding

Mocking "to be safe" without knowing what side effects the real method has.

**Before mocking, ask:**
1. What side effects does the real method have?
2. Does this test depend on any of those side effects?
3. Am I mocking at the right level?

**Fix:** Run test with real implementation first. Observe what needs to happen. Then add minimal mocking at the lowest level needed.

### 4. Incomplete Mocks

Partial mock objects missing fields that downstream code depends on.

**Fix:** Mirror the real API response completely. If uncertain, include all documented fields.

## Red Flags

- Mock setup is >50% of the test
- Test fails when you remove a mock
- Assertion checks for `*-mock` test IDs
- Methods only called in test files
- "Mocking just to be safe"
- Can't explain why the mock is needed

## Quick Reference

| Anti-Pattern | Fix |
|---|---|
| Assert on mock elements | Test real component or unmock |
| Test-only methods in production | Move to test utilities |
| Mock without understanding | Understand deps first, mock minimally |
| Incomplete mocks | Mirror real API completely |
| Over-complex mocks | Consider integration tests |
