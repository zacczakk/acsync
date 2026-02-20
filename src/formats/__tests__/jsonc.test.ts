import { describe, expect, test } from 'bun:test';
import { readJsonc, modifyJsonc } from '../jsonc';
import { ParseError } from '../../errors';

describe('readJsonc', () => {
  test('parses JSONC with line comments', () => {
    const input = `{
  // this is a comment
  "name": "test"
}`;
    const result = readJsonc<{ name: string }>(input);
    expect(result).toEqual({ name: 'test' });
  });

  test('parses JSONC with block comments', () => {
    const input = `{
  /* block comment */
  "key": "value"
}`;
    const result = readJsonc<{ key: string }>(input);
    expect(result).toEqual({ key: 'value' });
  });

  test('parses JSONC with trailing commas', () => {
    const input = `{
  "a": 1,
  "b": 2,
}`;
    const result = readJsonc<{ a: number; b: number }>(input);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  test('throws ParseError on malformed input', () => {
    expect(() => readJsonc('{{{{')).toThrow(ParseError);
  });
});

describe('modifyJsonc', () => {
  test('preserves comments when modifying a value', () => {
    const input = `{
  // important comment
  "name": "old",
  "version": 1
}`;
    const result = modifyJsonc(input, ['name'], 'new');
    expect(result).toContain('// important comment');
    expect(result).toContain('"name": "new"');
  });

  test('preserves comments when adding a new key', () => {
    const input = `{
  // keep me
  "existing": true
}`;
    const result = modifyJsonc(input, ['added'], 'value');
    expect(result).toContain('// keep me');
    expect(result).toContain('"existing": true');
    expect(result).toContain('"added": "value"');
  });

  test('works on nested paths', () => {
    const input = `{
  "mcpServers": {
    "tavily": {
      "command": "old"
    }
  }
}`;
    const result = modifyJsonc(input, ['mcpServers', 'tavily', 'command'], 'new');
    const parsed = readJsonc<{ mcpServers: { tavily: { command: string } } }>(result);
    expect(parsed.mcpServers.tavily.command).toBe('new');
  });

  test('handles adding nested objects', () => {
    const input = `{
  "servers": {}
}`;
    const result = modifyJsonc(input, ['servers', 'new-server'], { port: 3000 });
    const parsed = readJsonc<{ servers: { 'new-server': { port: number } } }>(result);
    expect(parsed.servers['new-server'].port).toBe(3000);
  });
});

describe('round-trip', () => {
  test('readJsonc(modifyJsonc(...)) reflects change and preserves comments', () => {
    const original = `{
  // server config
  "host": "localhost",
  "port": 3000,
  /* database settings */
  "db": {
    "name": "mydb"
  }
}`;
    const modified = modifyJsonc(original, ['port'], 8080);
    expect(modified).toContain('// server config');
    expect(modified).toContain('/* database settings */');

    const parsed = readJsonc<{ host: string; port: number; db: { name: string } }>(modified);
    expect(parsed.port).toBe(8080);
    expect(parsed.host).toBe('localhost');
    expect(parsed.db.name).toBe('mydb');
  });
});
