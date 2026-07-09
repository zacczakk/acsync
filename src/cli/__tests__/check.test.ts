import { describe, expect, test } from 'bun:test';
import { collect, mapTargets, mapTypes, validateTargets, validateTypes } from '../cli-helpers';

describe('collect', () => {
  test('collects values into array', () => {
    const result = collect('claude', []);
    expect(result).toEqual(['claude']);
  });

  test('appends to existing array', () => {
    const result = collect('codex', ['claude', 'antigravity']);
    expect(result).toEqual(['claude', 'antigravity', 'codex']);
  });

  test('accumulates multiple calls', () => {
    let arr: string[] = [];
    arr = collect('claude', arr);
    arr = collect('antigravity', arr);
    arr = collect('codex', arr);
    expect(arr).toEqual(['claude', 'antigravity', 'codex']);
  });
});

describe('mapTargets', () => {
  test('returns undefined for empty array', () => {
    expect(mapTargets([])).toBeUndefined();
  });

  test('maps claude to claude-code', () => {
    const result = mapTargets(['claude']);
    expect(result).toEqual(['claude-code']);
  });

  test('passes antigravity through unchanged', () => {
    expect(mapTargets(['antigravity'])).toEqual(['antigravity']);
  });

  test('passes codex through unchanged', () => {
    expect(mapTargets(['codex'])).toEqual(['codex']);
  });

  test('passes opencode through unchanged', () => {
    expect(mapTargets(['opencode'])).toEqual(['opencode']);
  });

  test('maps multiple targets', () => {
    const result = mapTargets(['claude', 'opencode', 'antigravity', 'codex']);
    expect(result).toEqual(['claude-code', 'opencode', 'antigravity', 'codex']);
  });
});

describe('mapTypes', () => {
  test('returns undefined for empty array', () => {
    expect(mapTypes([])).toBeUndefined();
  });

  test('maps commands to command', () => {
    expect(mapTypes(['commands'])).toEqual(['command']);
  });

  test('maps agents to agent', () => {
    expect(mapTypes(['agents'])).toEqual(['agent']);
  });

  test('maps mcps to mcp', () => {
    expect(mapTypes(['mcps'])).toEqual(['mcp']);
  });

  test('maps instructions to instruction', () => {
    expect(mapTypes(['instructions'])).toEqual(['instruction']);
  });

  test('maps skills to skill', () => {
    expect(mapTypes(['skills'])).toEqual(['skill']);
  });

  test('maps multiple types', () => {
    const result = mapTypes(['commands', 'agents', 'mcps', 'instructions', 'skills']);
    expect(result).toEqual(['command', 'agent', 'mcp', 'instruction', 'skill']);
  });
});

describe('validateTargets', () => {
  test('accepts all valid targets', () => {
    expect(() => validateTargets(['claude', 'antigravity', 'codex', 'opencode'])).not.toThrow();
  });

  test('accepts empty array', () => {
    expect(() => validateTargets([])).not.toThrow();
  });

  test('throws on invalid target', () => {
    expect(() => validateTargets(['invalid-target'])).toThrow('Invalid target');
    expect(() => validateTargets(['invalid-target'])).toThrow('invalid-target');
  });

  test('throws on claude-code (user must use claude)', () => {
    expect(() => validateTargets(['claude-code'])).toThrow('Invalid target');
  });
});

describe('validateTypes', () => {
  test('accepts all valid types', () => {
    expect(() =>
      validateTypes(['commands', 'agents', 'mcps', 'instructions', 'skills']),
    ).not.toThrow();
  });

  test('accepts empty array', () => {
    expect(() => validateTypes([])).not.toThrow();
  });

  test('throws on invalid type', () => {
    expect(() => validateTypes(['invalid-type'])).toThrow('Invalid type');
    expect(() => validateTypes(['invalid-type'])).toThrow('invalid-type');
  });

  test('throws on singular form (user must use plural)', () => {
    expect(() => validateTypes(['command'])).toThrow('Invalid type');
  });
});
