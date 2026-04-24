import { describe, expect, test } from 'bun:test';
import { AdapterPathResolver } from '../../adapters/path-resolver';
import { getCavemanStatePath } from '../caveman-paths';

describe('getCavemanStatePath', () => {
  test('returns per-target paths', () => {
    expect(getCavemanStatePath('claude-code', '/tmp/home')).toBe('/tmp/home/.claude/.caveman-active');
    expect(getCavemanStatePath('codex', '/tmp/home')).toBe('/tmp/home/.codex/.caveman-active');
    expect(getCavemanStatePath('opencode', '/tmp/home')).toBe('/tmp/home/.config/opencode/.caveman-active');
  });

  test('matches AdapterPathResolver output for supported targets', () => {
    expect(new AdapterPathResolver('claude-code', '/tmp/home').getCavemanStatePath()).toBe(
      getCavemanStatePath('claude-code', '/tmp/home'),
    );
    expect(new AdapterPathResolver('codex', '/tmp/home').getCavemanStatePath()).toBe(
      getCavemanStatePath('codex', '/tmp/home'),
    );
    expect(new AdapterPathResolver('opencode', '/tmp/home').getCavemanStatePath()).toBe(
      getCavemanStatePath('opencode', '/tmp/home'),
    );
  });
});
