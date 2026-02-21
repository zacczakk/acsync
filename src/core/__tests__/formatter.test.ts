import { describe, expect, test } from 'bun:test';
import { formatDiffJson, formatDiffPretty, formatPushResult, formatCheckResult, formatDryRunJson, formatDryRunPretty, formatDryRunResult } from '../formatter';
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
    expect(parsed.targets['claude']).toBeDefined();
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
    expect(Array.isArray(parsed.targets['claude'].operations)).toBe(true);
    expect(parsed.targets['claude'].operations).toHaveLength(1);
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
    expect(output).toContain('claude');
    expect(output).not.toContain('claude-code');
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
    expect(output).toContain('claude');
    expect(output).not.toContain('claude-code');
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

describe('formatDryRunJson', () => {
  test('produces valid JSON with dryRun flag', () => {
    const results = [makeResult('claude-code', [makeOp('create', 'cmd1')])];
    const parsed = JSON.parse(formatDryRunJson(results));
    expect(parsed.dryRun).toBe(true);
  });

  test('only includes create/update actions, not skips', () => {
    const results = [makeResult('claude-code', [
      makeOp('create', 'new-cmd'),
      makeOp('skip', 'existing-cmd'),
      makeOp('update', 'changed-cmd'),
    ])];
    const parsed = JSON.parse(formatDryRunJson(results));
    expect(parsed.actions).toHaveLength(2);
    expect(parsed.actions[0].action).toBe('create');
    expect(parsed.actions[1].action).toBe('update');
  });

  test('includes target path in actions', () => {
    const op = { ...makeOp('create', 'cmd1'), targetPath: '/home/user/.claude/commands/cmd1.md' };
    const results = [makeResult('claude-code', [op])];
    const parsed = JSON.parse(formatDryRunJson(results));
    expect(parsed.actions[0].path).toBe('/home/user/.claude/commands/cmd1.md');
  });

  test('uses display target name', () => {
    const results = [makeResult('claude-code', [makeOp('create', 'cmd1')])];
    const parsed = JSON.parse(formatDryRunJson(results));
    expect(parsed.actions[0].target).toBe('claude');
  });

  test('summary counts create and update separately', () => {
    const results = [makeResult('claude-code', [
      makeOp('create', 'a'),
      makeOp('create', 'b'),
      makeOp('update', 'c'),
      makeOp('skip', 'd'),
    ])];
    const parsed = JSON.parse(formatDryRunJson(results));
    expect(parsed.summary.create).toBe(2);
    expect(parsed.summary.update).toBe(1);
  });
});

describe('formatDryRunPretty', () => {
  test('contains dry-run header', () => {
    const results = [makeResult('claude-code', [makeOp('create', 'cmd1')])];
    const output = formatDryRunPretty(results);
    expect(output).toContain('acsync push --dry-run');
  });

  test('shows arrow and path for actionable items', () => {
    const op = { ...makeOp('create', 'cmd1'), targetPath: '/tmp/test/cmd1.md' };
    const results = [makeResult('claude-code', [op])];
    const output = formatDryRunPretty(results);
    expect(output).toContain('→');
    expect(output).toContain('/tmp/test/cmd1.md');
  });

  test('omits targets with only skip operations', () => {
    const results = [makeResult('claude-code', [makeOp('skip', 'cmd1')])];
    const output = formatDryRunPretty(results);
    expect(output).toContain('Nothing to push');
    expect(output).not.toContain('claude');
  });

  test('shows Would write summary', () => {
    const results = [makeResult('claude-code', [makeOp('create', 'x'), makeOp('update', 'y')])];
    const output = formatDryRunPretty(results);
    expect(output).toContain('Would write');
  });
});

describe('MCP warnings', () => {
  function makeResultWithWarning(
    target: 'claude-code' | 'opencode',
    action: 'remove' | 'orphan',
    serverNames: string[],
  ): DiffResult {
    return {
      target,
      operations: [{ ...makeOp('update', 'context7', target), itemType: 'mcp' }],
      summary: { create: 0, update: 1, skip: 0 },
      mcpWarning: { serverNames, action },
    };
  }

  test('formatDiffJson includes mcpWarning when present', () => {
    const results = [makeResultWithWarning('claude-code', 'remove', ['old-server', 'stale'])];
    const parsed = JSON.parse(formatDiffJson(results));
    expect(parsed.targets.claude.mcpWarning).toEqual({
      serverNames: ['old-server', 'stale'],
      action: 'remove',
    });
  });

  test('formatDiffJson omits mcpWarning when absent', () => {
    const results = [makeResult('claude-code', [makeOp('update', 'x')])];
    const parsed = JSON.parse(formatDiffJson(results));
    expect(parsed.targets.claude.mcpWarning).toBeUndefined();
  });

  test('formatDiffPretty shows per-server removal lines', () => {
    const results = [makeResultWithWarning('claude-code', 'remove', ['chrome-devtools', 'shadcn'])];
    const output = formatDiffPretty(results);
    expect(output).toContain('[mcp]');
    expect(output).toContain('chrome-devtools');
    expect(output).toContain('shadcn');
    expect(output).toContain('(removed)');
  });

  test('formatDiffPretty shows orphan lines', () => {
    const result: DiffResult = {
      target: 'opencode',
      operations: [{ ...makeOp('update', 'context7', 'opencode'), itemType: 'mcp' }],
      summary: { create: 0, update: 1, skip: 0 },
      mcpWarning: { serverNames: ['old-mcp'], action: 'orphan' },
    };
    const output = formatDiffPretty([result]);
    expect(output).toContain('old-mcp');
    expect(output).toContain('(orphaned)');
  });

  test('formatDiffPretty summary includes removal count', () => {
    const results = [makeResultWithWarning('claude-code', 'remove', ['a', 'b', 'c'])];
    const output = formatDiffPretty(results);
    expect(output).toContain('3 to remove');
  });

  test('formatDryRunPretty shows per-server removal lines', () => {
    const results = [makeResultWithWarning('claude-code', 'remove', ['legacy'])];
    const output = formatDryRunPretty(results);
    expect(output).toContain('[mcp]');
    expect(output).toContain('legacy');
    expect(output).toContain('remove');
  });

  test('formatDryRunJson includes warnings array', () => {
    const results = [makeResultWithWarning('claude-code', 'remove', ['old'])];
    const parsed = JSON.parse(formatDryRunJson(results));
    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.warnings[0].target).toBe('claude');
    expect(parsed.warnings[0].mcpWarning.serverNames).toEqual(['old']);
  });

  test('formatDryRunJson omits warnings when none present', () => {
    const results = [makeResult('claude-code', [makeOp('create', 'x')])];
    const parsed = JSON.parse(formatDryRunJson(results));
    expect(parsed.warnings).toBeUndefined();
  });
});

describe('formatDryRunResult', () => {
  test('hasDrift=true when actions exist', () => {
    const results = [makeResult('claude-code', [makeOp('create', 'x')])];
    const { hasDrift } = formatDryRunResult(results, false);
    expect(hasDrift).toBe(true);
  });

  test('hasDrift=false when only skips', () => {
    const results = [makeResult('claude-code', [makeOp('skip', 'x')])];
    const { hasDrift } = formatDryRunResult(results, false);
    expect(hasDrift).toBe(false);
  });

  test('returns JSON when pretty=false', () => {
    const results = [makeResult('claude-code', [makeOp('create', 'x')])];
    const { output } = formatDryRunResult(results, false);
    expect(() => JSON.parse(output)).not.toThrow();
    expect(JSON.parse(output).dryRun).toBe(true);
  });

  test('returns pretty output when pretty=true', () => {
    const results = [makeResult('claude-code', [makeOp('create', 'x')])];
    const { output } = formatDryRunResult(results, true);
    expect(output).toContain('acsync push --dry-run');
  });
});
