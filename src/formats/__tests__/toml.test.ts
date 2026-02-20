import { describe, expect, test } from 'bun:test';
import { readToml, writeToml } from '../toml';
import { ParseError } from '../../errors';

describe('readToml', () => {
  test('parses valid TOML with strings, numbers, booleans', () => {
    const input = `
name = "test"
port = 8080
enabled = true
`;
    const result = readToml<{ name: string; port: number; enabled: boolean }>(input);
    expect(result.name).toBe('test');
    expect(result.port).toBe(8080);
    expect(result.enabled).toBe(true);
  });

  test('parses arrays', () => {
    const input = `tags = ["a", "b", "c"]`;
    const result = readToml<{ tags: string[] }>(input);
    expect(result.tags).toEqual(['a', 'b', 'c']);
  });

  test('parses nested tables', () => {
    const input = `
[server]
host = "localhost"
port = 3000

[server.db]
name = "mydb"
`;
    const result = readToml<{ server: { host: string; port: number; db: { name: string } } }>(input);
    expect(result.server.host).toBe('localhost');
    expect(result.server.port).toBe(3000);
    expect(result.server.db.name).toBe('mydb');
  });

  test('parses inline tables', () => {
    const input = `point = { x = 1, y = 2 }`;
    const result = readToml<{ point: { x: number; y: number } }>(input);
    expect(result.point).toEqual({ x: 1, y: 2 });
  });

  test('throws ParseError on invalid TOML', () => {
    expect(() => readToml('= invalid')).toThrow(ParseError);
  });

  test('ParseError includes operation context', () => {
    try {
      readToml('[bad\nkey = ');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ParseError);
      const pe = error as InstanceType<typeof ParseError>;
      expect(pe.operation).toBe('readToml');
      expect(pe.name).toBe('ParseError');
    }
  });
});

describe('writeToml', () => {
  test('produces valid TOML string with trailing newline', () => {
    const result = writeToml({ name: 'test' });
    expect(result).toContain('name = "test"');
    expect(result.endsWith('\n')).toBe(true);
  });

  test('handles nested objects', () => {
    const result = writeToml({
      server: { host: 'localhost', port: 3000 },
    });
    expect(result).toContain('[server]');
    expect(result).toContain('host = "localhost"');
  });
});

describe('round-trip', () => {
  test('writeToml -> readToml preserves data types', () => {
    const original = {
      name: 'config',
      port: 8080,
      enabled: true,
      tags: ['a', 'b'],
    };
    const serialized = writeToml(original);
    const deserialized = readToml<typeof original>(serialized);
    expect(deserialized.name).toBe(original.name);
    expect(deserialized.port).toBe(original.port);
    expect(deserialized.enabled).toBe(original.enabled);
    expect(deserialized.tags).toEqual(original.tags);
  });

  test('integer stays integer, not float', () => {
    const original = { count: 42 };
    const serialized = writeToml(original);
    expect(serialized).toContain('count = 42');
    expect(serialized).not.toContain('42.0');
    const deserialized = readToml<{ count: number }>(serialized);
    expect(deserialized.count).toBe(42);
    expect(Number.isInteger(deserialized.count)).toBe(true);
  });
});
