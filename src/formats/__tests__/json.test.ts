import { describe, expect, test } from 'bun:test';
import { readJson, writeJson } from '../json';
import { ParseError } from '../../errors';

describe('readJson', () => {
  test('parses valid JSON', () => {
    const result = readJson<{ name: string }>('{"name": "test"}');
    expect(result).toEqual({ name: 'test' });
  });

  test('parses arrays', () => {
    const result = readJson<number[]>('[1, 2, 3]');
    expect(result).toEqual([1, 2, 3]);
  });

  test('throws ParseError on invalid JSON', () => {
    expect(() => readJson('{invalid')).toThrow(ParseError);
  });

  test('ParseError includes operation context', () => {
    try {
      readJson('{bad}');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ParseError);
      const pe = error as InstanceType<typeof ParseError>;
      expect(pe.operation).toBe('readJson');
      expect(pe.path).toBe('<string input>');
      expect(pe.name).toBe('ParseError');
    }
  });
});

describe('writeJson', () => {
  test('produces indented JSON with trailing newline', () => {
    const result = writeJson({ a: 1 });
    expect(result).toBe('{\n  "a": 1\n}\n');
  });

  test('uses default 2-space indent', () => {
    const result = writeJson({ nested: { key: 'val' } });
    expect(result).toContain('  "nested"');
    expect(result).toContain('    "key"');
  });

  test('respects custom indent', () => {
    const result = writeJson({ a: 1 }, 4);
    expect(result).toBe('{\n    "a": 1\n}\n');
  });

  test('ends with newline', () => {
    const result = writeJson([1, 2]);
    expect(result.endsWith('\n')).toBe(true);
  });
});

describe('round-trip', () => {
  test('writeJson -> readJson preserves data', () => {
    const original = {
      name: 'config',
      version: 42,
      nested: { key: 'value', arr: [1, 2, 3] },
      flag: true,
      nothing: null,
    };
    const serialized = writeJson(original);
    const deserialized = readJson(serialized);
    expect(deserialized).toEqual(original);
  });
});
