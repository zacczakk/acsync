import { describe, it, expect } from 'bun:test';
import { EnvVarTransformer } from '../env-var-transformer';

describe('EnvVarTransformer.transform', () => {
  it('returns value unchanged when from === to', () => {
    expect(EnvVarTransformer.transform('${FOO}', 'claude-code', 'claude-code')).toBe('${FOO}');
  });

  it('claude-code → opencode: converts ${VAR} to {env:VAR}', () => {
    expect(EnvVarTransformer.transform('${API_KEY}', 'claude-code', 'opencode')).toBe('{env:API_KEY}');
  });

  it('opencode → claude-code: converts {env:VAR} to ${VAR}', () => {
    expect(EnvVarTransformer.transform('{env:API_KEY}', 'opencode', 'claude-code')).toBe('${API_KEY}');
  });

  it('gemini → opencode: converts ${VAR} to {env:VAR}', () => {
    expect(EnvVarTransformer.transform('${SECRET}', 'gemini', 'opencode')).toBe('{env:SECRET}');
  });

  it('opencode → gemini: converts {env:VAR} to ${VAR}', () => {
    expect(EnvVarTransformer.transform('{env:SECRET}', 'opencode', 'gemini')).toBe('${SECRET}');
  });

  it('claude-code → codex: strips ${} wrapper', () => {
    expect(EnvVarTransformer.transform('${MY_VAR}', 'claude-code', 'codex')).toBe('MY_VAR');
  });

  it('identity: gemini format matches claude-code', () => {
    const val = 'Bearer ${TOKEN}';
    expect(EnvVarTransformer.transform(val, 'gemini', 'claude-code')).toBe(val);
  });
});

describe('EnvVarTransformer recursive handling', () => {
  it('transforms strings inside arrays', () => {
    const input = ['${FOO}', '${BAR}'];
    const result = EnvVarTransformer.transform(input, 'claude-code', 'opencode');
    expect(result).toEqual(['{env:FOO}', '{env:BAR}']);
  });

  it('transforms strings inside objects', () => {
    const input = { key: '${SECRET}', nested: { deep: '${DEEP}' } };
    const result = EnvVarTransformer.transform(input, 'claude-code', 'opencode');
    expect(result).toEqual({ key: '{env:SECRET}', nested: { deep: '{env:DEEP}' } });
  });

  it('leaves non-string primitives unchanged', () => {
    expect(EnvVarTransformer.transform(42, 'claude-code', 'opencode')).toBe(42);
    expect(EnvVarTransformer.transform(true, 'claude-code', 'opencode')).toBe(true);
    expect(EnvVarTransformer.transform(null, 'claude-code', 'opencode')).toBeNull();
  });
});

describe('EnvVarTransformer quick converters', () => {
  it('toOpenCode converts from claude-code format', () => {
    expect(EnvVarTransformer.toOpenCode('${KEY}')).toBe('{env:KEY}');
  });

  it('fromOpenCode converts from opencode format', () => {
    expect(EnvVarTransformer.fromOpenCode('{env:KEY}')).toBe('${KEY}');
  });
});
