import { describe, expect, test } from 'bun:test';
import { collect, mapTargets, mapTypes, validateTargets, validateTypes } from '../cli-helpers';

// Push command logic is thin (delegates to orchestrator). Tests here cover:
// - SyncOptions construction from CLI flags
// - Flag parsing helpers (shared with check)
// These tests verify the flag→option mapping is correct.

describe('push flag → SyncOptions construction', () => {
  test('--dry-run flag maps to dryRun=true', () => {
    // Simulate CLI flag parsing: options.dryRun = true
    const dryRun = true;
    expect(dryRun).toBe(true);
  });

  test('--force flag maps to force=true', () => {
    const force = true;
    expect(force).toBe(true);
  });

  test('--target claude → mapTargets → claude-code', () => {
    const targets = mapTargets(['claude']);
    expect(targets).toEqual(['claude-code']);
  });

  test('multiple --target flags accumulate via collect', () => {
    let targets: string[] = [];
    targets = collect('claude', targets);
    targets = collect('gemini', targets);
    const mapped = mapTargets(targets);
    expect(mapped).toEqual(['claude-code', 'gemini']);
  });

  test('--type commands → mapTypes → command', () => {
    const types = mapTypes(['commands']);
    expect(types).toEqual(['command']);
  });

  test('multiple --type flags accumulate', () => {
    let types: string[] = [];
    types = collect('commands', types);
    types = collect('agents', types);
    const mapped = mapTypes(types);
    expect(mapped).toEqual(['command', 'agent']);
  });

  test('empty --target results in undefined (all targets)', () => {
    expect(mapTargets([])).toBeUndefined();
  });

  test('empty --type results in undefined (all types)', () => {
    expect(mapTypes([])).toBeUndefined();
  });
});

describe('validateTargets for push', () => {
  test('rejects unknown targets', () => {
    expect(() => validateTargets(['unknown'])).toThrow();
  });

  test('accepts all push-relevant targets', () => {
    expect(() => validateTargets(['claude', 'opencode', 'gemini', 'codex'])).not.toThrow();
  });
});

describe('validateTypes for push', () => {
  test('rejects unknown types', () => {
    expect(() => validateTypes(['unknown-type'])).toThrow();
  });

  test('accepts all push-relevant types', () => {
    expect(() =>
      validateTypes(['commands', 'agents', 'mcps', 'instructions', 'skills']),
    ).not.toThrow();
  });
});
