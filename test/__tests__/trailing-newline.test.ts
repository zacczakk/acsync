import { describe, expect, test } from 'bun:test';
import { hashContent } from '../../src/cli/canonical';

describe('hashContent trailing-newline normalization', () => {
  test('trailing newline does not affect hash', () => {
    const base = hashContent('{"key": "value"}');
    const withNewline = hashContent('{"key": "value"}\n');
    const withDoubleNewline = hashContent('{"key": "value"}\n\n');
    expect(withNewline).toBe(base);
    expect(withDoubleNewline).toBe(base);
  });

  test('interior whitespace still matters', () => {
    const a = hashContent('{"key": "value"}');
    const b = hashContent('{"key":"value"}');
    expect(a).not.toBe(b);
  });
});
