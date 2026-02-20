import { describe, expect, test } from 'bun:test';
import { formatDiffJson, formatDiffPretty, formatPushResult, formatCheckResult } from '../formatter';
import type { DiffResult, Operation } from '../../types';

function makeOp(
  type: 'create' | 'update' | 'skip',
  name: string,
  target: 'claude-code' | 'opencode' | 'gemini' | 'codex' = 'claude-code',
): Operation {
  return {
    type,
    itemType: 'command',
    name,
    target,
    reason: 'test',
    newHash: 'hash',
  };
}

function makeResult(target: 'claude-code' | 'opencode' | 'gemini' | 'codex', ops: Operation[]): DiffResult {
  return {
    target,
    operations: ops,
    summary: {
      create: ops.filter((o) => o.type === 'create').length,
      update: ops.filter((o) => o.type === 'update').length,
      skip: ops.filter((o) => o.type === 'skip').length,
    },
  };
}

describe('formatDiffJson', () => {
  test('produces valid parseable JSON', () => {
    const results = [makeResult('claude-code', [makeOp('create', 'cmd1')])];
    const output = formatDiffJson(results);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  test('contains target names as keys', () => {
    const results = [
      makeResult('claude-code', [makeOp('create', 'cmd1')]),
      makeResult('opencode', [makeOp('skip', 'cmd2', 'opencode')]),
    ];
    const parsed = JSON.parse(formatDiffJson(results));
    expect(parsed.targets['claude-code']).toBeDefined();
    expect(parsed.targets['opencode']).toBeDefined();
  });

  test('has correct summary counts', () => {
    const results = [
      makeResult('claude-code', [
        makeOp('create', 'a'),
        makeOp('create', 'b'),
        makeOp('update', 'c'),
        makeOp('skip', 'd'),
        makeOp('skip', 'e'),
      ]),
      makeResult('opencode', [makeOp('create', 'x', 'opencode')]),
    ];
    const parsed = JSON.parse(formatDiffJson(results));
    expect(parsed.summary.totalCreate).toBe(3);
    expect(parsed.summary.totalUpdate).toBe(1);
    expect(parsed.summary.totalSkip).toBe(2);
  });

  test('includes operations array in each target', () => {
    const results = [makeResult('claude-code', [makeOp('create', 'cmd1')])];
    const parsed = JSON.parse(formatDiffJson(results));
    expect(Array.isArray(parsed.targets['claude-code'].operations)).toBe(true);
    expect(parsed.targets['claude-code'].operations).toHaveLength(1);
  });

  test('empty results produce valid JSON with zero counts', () => {
    const parsed = JSON.parse(formatDiffJson([]));
    expect(parsed.summary.totalCreate).toBe(0);
    expect(parsed.summary.totalUpdate).toBe(0);
    expect(parsed.summary.totalSkip).toBe(0);
  });
});

describe('formatDiffPretty', () => {
  test('contains target names', () => {
    const results = [
      makeResult('claude-code', [makeOp('create', 'cmd1')]),
      makeResult('opencode', [makeOp('skip', 'cmd2', 'opencode')]),
    ];
    const output = formatDiffPretty(results);
    expect(output).toContain('claude-code');
    expect(output).toContain('opencode');
  });

  test('contains + symbol for create operations', () => {
    const results = [makeResult('claude-code', [makeOp('create', 'new-cmd')])];
    const output = formatDiffPretty(results);
    expect(output).toContain('+');
    expect(output).toContain('new-cmd');
  });

  test('contains ~ symbol for update operations', () => {
    const results = [
      makeResult('claude-code', [{ ...makeOp('update', 'old-cmd'), oldHash: 'old' }]),
    ];
    const output = formatDiffPretty(results);
    expect(output).toContain('~');
  });

  test('contains ✓ symbol for skip operations', () => {
    const results = [makeResult('claude-code', [makeOp('skip', 'up-to-date')])];
    const output = formatDiffPretty(results);
    expect(output).toContain('✓');
  });

  test('contains summary line', () => {
    const results = [makeResult('claude-code', [makeOp('create', 'x'), makeOp('skip', 'y')])];
    const output = formatDiffPretty(results);
    expect(output).toContain('Summary:');
  });

  test('contains acsync check header', () => {
    const output = formatDiffPretty([]);
    expect(output).toContain('acsync check');
  });
});

describe('formatPushResult', () => {
  const pushResults = [
    {
      target: 'claude-code' as const,
      operations: [makeOp('create', 'cmd1'), makeOp('skip', 'cmd2')],
      success: true,
    },
    {
      target: 'opencode' as const,
      operations: [],
      success: false,
      error: 'write failed',
    },
  ];

  test('JSON mode produces valid JSON', () => {
    const output = formatPushResult(pushResults, false);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  test('JSON mode has correct success/failed counts', () => {
    const parsed = JSON.parse(formatPushResult(pushResults, false));
    expect(parsed.summary.succeeded).toBe(1);
    expect(parsed.summary.failed).toBe(1);
  });

  test('pretty mode contains target names', () => {
    const output = formatPushResult(pushResults, true);
    expect(output).toContain('claude-code');
    expect(output).toContain('opencode');
  });

  test('pretty mode shows error message', () => {
    const output = formatPushResult(pushResults, true);
    expect(output).toContain('write failed');
  });
});

describe('formatCheckResult', () => {
  test('hasDrift=false when all skip', () => {
    const results = [makeResult('claude-code', [makeOp('skip', 'x')])];
    const { hasDrift } = formatCheckResult(results, false);
    expect(hasDrift).toBe(false);
  });

  test('hasDrift=true when any create', () => {
    const results = [makeResult('claude-code', [makeOp('create', 'x')])];
    const { hasDrift } = formatCheckResult(results, false);
    expect(hasDrift).toBe(true);
  });

  test('hasDrift=true when any update', () => {
    const results = [makeResult('claude-code', [makeOp('update', 'x')])];
    const { hasDrift } = formatCheckResult(results, false);
    expect(hasDrift).toBe(true);
  });

  test('returns JSON when pretty=false', () => {
    const results = [makeResult('claude-code', [])];
    const { output } = formatCheckResult(results, false);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  test('returns human output when pretty=true', () => {
    const results = [makeResult('claude-code', [])];
    const { output } = formatCheckResult(results, true);
    expect(output).toContain('acsync check');
  });

  test('hasDrift=false for empty results', () => {
    const { hasDrift } = formatCheckResult([], false);
    expect(hasDrift).toBe(false);
  });
});
