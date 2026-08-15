import { describe, expect, test } from 'bun:test';
import { hashMCPServer } from '../hash';

describe('hashMCPServer', () => {
  test('ignores object key order while preserving server semantics', () => {
    const first = {
      name: 'github',
      transport: 'http' as const,
      url: 'https://example.com/mcp',
      headers: { Authorization: 'Bearer ${TOKEN}', Accept: 'application/json' },
      targetOptions: { opencode2: { timeout: { execution: 20_000, catalog: 20_000 } } },
    };
    const second = {
      targetOptions: { opencode2: { timeout: { catalog: 20_000, execution: 20_000 } } },
      headers: { Accept: 'application/json', Authorization: 'Bearer ${TOKEN}' },
      url: 'https://example.com/mcp',
      transport: 'http' as const,
      name: 'github',
    };

    expect(hashMCPServer(first)).toBe(hashMCPServer(second));
  });

  test('returns null for a missing target server', () => {
    expect(hashMCPServer(undefined)).toBeNull();
  });
});
