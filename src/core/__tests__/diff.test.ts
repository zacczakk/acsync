import { describe, expect, test } from 'bun:test';
import { compareHashes, calculateDiff } from '../diff';
import { createEmptyManifest, updateManifestItem } from '../manifest';

describe('compareHashes', () => {
  test('case 1: sourceHash null → skip (safe mode)', () => {
    const result = compareHashes(null, 'tgt', 'manifest');
    expect(result.operation).toBe('skip');
    expect(result.reason).toContain('safe mode');
  });

  test('case 2: targetHash null → create', () => {
    const result = compareHashes('src', null, null);
    expect(result.operation).toBe('create');
    expect(result.reason).toContain('not in target');
  });

  test('case 3: all three match → skip', () => {
    const result = compareHashes('abc', 'abc', 'abc');
    expect(result.operation).toBe('skip');
    expect(result.reason).toContain('up to date');
  });

  test('case 4: source === target, manifest different → skip', () => {
    const result = compareHashes('abc', 'abc', 'old');
    expect(result.operation).toBe('skip');
    expect(result.reason).toContain('up to date');
  });

  test('case 5: source !== target → update', () => {
    const result = compareHashes('new', 'old', 'old');
    expect(result.operation).toBe('update');
    expect(result.reason).toContain('changed');
  });

  test('source !== target, no manifest → update', () => {
    const result = compareHashes('new', 'old', null);
    expect(result.operation).toBe('update');
  });

  test('never produces delete operation', () => {
    // All combinations that could theoretically produce delete should not
    const cases: [string | null, string | null, string | null][] = [
      [null, null, null],
      [null, 'tgt', null],
      [null, null, 'mfst'],
      [null, 'tgt', 'mfst'],
    ];
    for (const [s, t, m] of cases) {
      const r = compareHashes(s, t, m);
      expect(r.operation).not.toBe('delete');
    }
  });
});

describe('calculateDiff', () => {
  test('all new items → create operations', () => {
    const manifest = createEmptyManifest();
    const source = [
      { type: 'command' as const, name: 'cmd1', hash: 'h1' },
      { type: 'agent' as const, name: 'agent1', hash: 'h2' },
    ];
    const targetHashes = new Map<string, string>();

    const result = calculateDiff(source, targetHashes, manifest, 'claude-code');

    expect(result.target).toBe('claude-code');
    expect(result.summary.create).toBe(2);
    expect(result.summary.update).toBe(0);
    expect(result.summary.skip).toBe(0);
    expect(result.operations).toHaveLength(2);
    expect(result.operations.every((op) => op.type === 'create')).toBe(true);
  });

  test('all up-to-date items → skip operations', () => {
    const manifest = createEmptyManifest();
    const source = [
      { type: 'command' as const, name: 'cmd1', hash: 'h1' },
    ];
    const targetHashes = new Map([['command/cmd1', 'h1']]);

    const result = calculateDiff(source, targetHashes, manifest, 'opencode');

    expect(result.summary.skip).toBe(1);
    expect(result.summary.create).toBe(0);
    expect(result.summary.update).toBe(0);
  });

  test('changed items → update operations', () => {
    const manifest = createEmptyManifest();
    const source = [
      { type: 'agent' as const, name: 'planner', hash: 'newHash' },
    ];
    const targetHashes = new Map([['agent/planner', 'oldHash']]);

    const result = calculateDiff(source, targetHashes, manifest, 'gemini');

    expect(result.summary.update).toBe(1);
    expect(result.operations[0].oldHash).toBe('oldHash');
    expect(result.operations[0].newHash).toBe('newHash');
  });

  test('mixed create/update/skip operations', () => {
    const manifest = createEmptyManifest();
    const source = [
      { type: 'command' as const, name: 'new-cmd', hash: 'h1' },     // create
      { type: 'command' as const, name: 'updated-cmd', hash: 'h2' },  // update
      { type: 'command' as const, name: 'same-cmd', hash: 'h3' },     // skip
    ];
    const targetHashes = new Map([
      ['command/updated-cmd', 'old'],
      ['command/same-cmd', 'h3'],
    ]);

    const result = calculateDiff(source, targetHashes, manifest, 'codex');

    expect(result.summary.create).toBe(1);
    expect(result.summary.update).toBe(1);
    expect(result.summary.skip).toBe(1);
    expect(result.operations).toHaveLength(3);
  });

  test('operations include target name', () => {
    const manifest = createEmptyManifest();
    const source = [{ type: 'mcp' as const, name: 'context7', hash: 'h1' }];
    const targetHashes = new Map<string, string>();

    const result = calculateDiff(source, targetHashes, manifest, 'claude-code');

    expect(result.operations[0].target).toBe('claude-code');
  });

  test('uses manifest hash for 3-way comparison', () => {
    const manifest = createEmptyManifest();
    // Seed manifest with a previously synced value
    updateManifestItem(manifest, 'command', 'cmd1', 'hash1', 'opencode', 'hash1');

    const source = [{ type: 'command' as const, name: 'cmd1', hash: 'hash1' }];
    const targetHashes = new Map([['command/cmd1', 'hash1']]);

    const result = calculateDiff(source, targetHashes, manifest, 'opencode');

    expect(result.summary.skip).toBe(1);
  });

  test('sourcePath and targetPath are forwarded to operations', () => {
    const manifest = createEmptyManifest();
    const source = [
      {
        type: 'command' as const,
        name: 'cmd1',
        hash: 'h1',
        sourcePath: '/canonical/cmd1.md',
        targetPath: '/target/cmd1.md',
      },
    ];
    const targetHashes = new Map<string, string>();

    const result = calculateDiff(source, targetHashes, manifest, 'claude-code');

    expect(result.operations[0].sourcePath).toBe('/canonical/cmd1.md');
    expect(result.operations[0].targetPath).toBe('/target/cmd1.md');
  });

  test('empty source items → empty result', () => {
    const manifest = createEmptyManifest();
    const result = calculateDiff([], new Map(), manifest, 'codex');

    expect(result.operations).toHaveLength(0);
    expect(result.summary).toEqual({ create: 0, update: 0, skip: 0 });
  });
});
