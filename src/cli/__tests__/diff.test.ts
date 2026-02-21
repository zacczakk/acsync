import { describe, expect, test } from 'bun:test';
import { unifiedDiff } from '../diff';

describe('unifiedDiff', () => {
  test('returns null when strings are identical', () => {
    const result = unifiedDiff('hello\nworld\n', 'hello\nworld\n', 'test.txt');
    expect(result).toBeNull();
  });

  test('shows --- and +++ headers', () => {
    const result = unifiedDiff('old line\n', 'new line\n', 'test.txt');
    expect(result).not.toBeNull();
    expect(result).toContain('--- a/test.txt');
    expect(result).toContain('+++ b/test.txt');
  });

  test('shows additions for create (empty old)', () => {
    const result = unifiedDiff('', 'line 1\nline 2\n', 'new-file.txt');
    expect(result).not.toBeNull();
    expect(result).toContain('+line 1');
    expect(result).toContain('+line 2');
  });

  test('shows removal and addition lines for changes', () => {
    const a = 'line 1\nold line\nline 3\n';
    const b = 'line 1\nnew line\nline 3\n';
    const result = unifiedDiff(a, b, 'changed.txt');
    expect(result).not.toBeNull();
    expect(result).toContain('-old line');
    expect(result).toContain('+new line');
  });

  test('includes @@ hunk headers', () => {
    const result = unifiedDiff('old\n', 'new\n', 'test.txt');
    expect(result).not.toBeNull();
    expect(result).toContain('@@');
  });

  test('handles multi-line additions at end', () => {
    const a = 'line 1\n';
    const b = 'line 1\nline 2\nline 3\n';
    const result = unifiedDiff(a, b, 'test.txt');
    expect(result).not.toBeNull();
    expect(result).toContain('+line 2');
    expect(result).toContain('+line 3');
  });

  test('handles multi-line removals', () => {
    const a = 'line 1\nline 2\nline 3\n';
    const b = 'line 1\n';
    const result = unifiedDiff(a, b, 'test.txt');
    expect(result).not.toBeNull();
    expect(result).toContain('-line 2');
    expect(result).toContain('-line 3');
  });
});
