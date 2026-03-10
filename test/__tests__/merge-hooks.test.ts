import { describe, expect, test } from 'bun:test';
import { mergeHooks, extractManagedHooks } from '../../src/adapters/merge';

describe('mergeHooks', () => {
  test('preserves user groups and appends canonical groups', () => {
    const existing = {
      SessionStart: [
        { hooks: [{ type: 'command', command: 'echo user' }] },
      ],
    };
    const canonical = {
      SessionStart: [
        { _managed: 'acsync', hooks: [{ type: 'command', command: 'echo managed' }] },
      ],
    };

    const result = mergeHooks(existing, canonical);
    expect(result.SessionStart).toHaveLength(2);
    expect(result.SessionStart[0]).toEqual({ hooks: [{ type: 'command', command: 'echo user' }] });
    expect(result.SessionStart[1]._managed).toBe('acsync');
  });

  test('replaces managed groups on re-push (no duplication)', () => {
    const existing = {
      SessionStart: [
        { hooks: [{ type: 'command', command: 'echo user' }] },
        { _managed: 'acsync', hooks: [{ type: 'command', command: 'echo old-managed' }] },
      ],
    };
    const canonical = {
      SessionStart: [
        { _managed: 'acsync', hooks: [{ type: 'command', command: 'echo new-managed' }] },
      ],
    };

    const result = mergeHooks(existing, canonical);
    expect(result.SessionStart).toHaveLength(2);
    expect(result.SessionStart[0].hooks[0].command).toBe('echo user');
    expect(result.SessionStart[1].hooks[0].command).toBe('echo new-managed');
  });

  test('creates event key missing from existing', () => {
    const existing = {};
    const canonical = {
      Notification: [
        { _managed: 'acsync', hooks: [{ type: 'command', command: 'notify' }] },
      ],
    };

    const result = mergeHooks(existing, canonical);
    expect(result.Notification).toHaveLength(1);
    expect(result.Notification[0]._managed).toBe('acsync');
  });

  test('preserves event key missing from canonical', () => {
    const existing = {
      CustomEvent: [
        { hooks: [{ type: 'command', command: 'echo custom' }] },
      ],
    };
    const canonical = {};

    const result = mergeHooks(existing, canonical);
    expect(result.CustomEvent).toHaveLength(1);
    expect(result.CustomEvent[0].hooks[0].command).toBe('echo custom');
  });

  test('handles empty arrays', () => {
    const existing = { SessionStart: [] };
    const canonical = { SessionStart: [] };
    const result = mergeHooks(existing, canonical);
    expect(result.SessionStart).toEqual([]);
  });

  test('handles both empty', () => {
    const result = mergeHooks({}, {});
    expect(result).toEqual({});
  });

  test('multiple event keys merged independently', () => {
    const existing = {
      SessionStart: [{ hooks: [{ type: 'command', command: 'echo start' }] }],
      PreCompact: [{ hooks: [{ type: 'command', command: 'echo compact' }] }],
    };
    const canonical = {
      SessionStart: [{ _managed: 'acsync', hooks: [{ type: 'command', command: 'managed-start' }] }],
      Notification: [{ _managed: 'acsync', hooks: [{ type: 'command', command: 'managed-notify' }] }],
    };

    const result = mergeHooks(existing, canonical);
    expect(result.SessionStart).toHaveLength(2);
    expect(result.PreCompact).toHaveLength(1);
    expect(result.Notification).toHaveLength(1);
  });
});

describe('extractManagedHooks', () => {
  test('filters to only managed groups', () => {
    const hooks = {
      SessionStart: [
        { hooks: [{ type: 'command', command: 'echo user' }] },
        { _managed: 'acsync', hooks: [{ type: 'command', command: 'echo managed' }] },
      ],
      CustomEvent: [
        { hooks: [{ type: 'command', command: 'echo custom' }] },
      ],
    };

    const result = extractManagedHooks(hooks);
    expect(Object.keys(result)).toEqual(['SessionStart']);
    expect(result.SessionStart).toHaveLength(1);
    expect(result.SessionStart[0]._managed).toBe('acsync');
  });

  test('returns empty for no managed groups', () => {
    const hooks = {
      SessionStart: [{ hooks: [{ type: 'command', command: 'echo user' }] }],
    };
    const result = extractManagedHooks(hooks);
    expect(result).toEqual({});
  });

  test('handles empty input', () => {
    expect(extractManagedHooks({})).toEqual({});
  });
});
