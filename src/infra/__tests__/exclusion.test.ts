import { describe, expect, test } from 'bun:test';
import { createExclusionFilter, classifyEntry, EXCLUSION_PATTERNS } from '../exclusion';

describe('createExclusionFilter', () => {
  test('matches gsd-* files', () => {
    const isExcluded = createExclusionFilter(['gsd-*']);
    expect(isExcluded('gsd-tools.cjs')).toBe(true);
    expect(isExcluded('gsd-plan-checker.md')).toBe(true);
  });

  test('does not match non-gsd files', () => {
    const isExcluded = createExclusionFilter(['gsd-*']);
    expect(isExcluded('my-gsd-thing')).toBe(false);
    expect(isExcluded('tools.cjs')).toBe(false);
  });

  test('matches multiple patterns', () => {
    const isExcluded = createExclusionFilter(['*.bak', '.DS_Store']);
    expect(isExcluded('foo.bak')).toBe(true);
    expect(isExcluded('.DS_Store')).toBe(true);
    expect(isExcluded('foo.txt')).toBe(false);
  });

  test('matches against basename for paths', () => {
    const isExcluded = createExclusionFilter(['gsd-*']);
    expect(isExcluded('some/deep/path/gsd-tools.cjs')).toBe(true);
    expect(isExcluded('some/deep/path/other.cjs')).toBe(false);
  });

  test('defaults to EXCLUSION_PATTERNS when called with no args', () => {
    const isExcluded = createExclusionFilter();
    expect(isExcluded('gsd-plan-phase.md')).toBe(true);
    expect(isExcluded('gsd')).toBe(true);
    expect(isExcluded('.sync-manifest.json')).toBe(true);
    expect(isExcluded('.gsd-file-manifest.json')).toBe(true);
    expect(isExcluded('.DS_Store')).toBe(true);
    expect(isExcluded('.acsync-backup-123')).toBe(true);
    expect(isExcluded('my-command.md')).toBe(false);
  });
});

describe('EXCLUSION_PATTERNS coverage (sync-spec §Exclusion Rules)', () => {
  const isExcluded = createExclusionFilter();

  test('excludes gsd-* prefixed files', () => {
    expect(isExcluded('gsd-plan-phase.md')).toBe(true);
    expect(isExcluded('gsd-executor.md')).toBe(true);
    expect(isExcluded('gsd-tools.cjs')).toBe(true);
  });

  test('excludes bare gsd directory name', () => {
    expect(isExcluded('gsd')).toBe(true);
  });

  test('excludes .sync-manifest.json (GSD artifact)', () => {
    expect(isExcluded('.sync-manifest.json')).toBe(true);
    expect(isExcluded('path/to/.sync-manifest.json')).toBe(true);
  });

  test('excludes .gsd-file-manifest.json (GSD artifact)', () => {
    expect(isExcluded('.gsd-file-manifest.json')).toBe(true);
    expect(isExcluded('deep/path/.gsd-file-manifest.json')).toBe(true);
  });

  test('excludes .DS_Store', () => {
    expect(isExcluded('.DS_Store')).toBe(true);
  });

  test('excludes .acsync-backup-* files', () => {
    expect(isExcluded('.acsync-backup-abc123')).toBe(true);
    expect(isExcluded('.acsync-backup-2026-01-01')).toBe(true);
  });

  test('does not exclude normal canonical files', () => {
    expect(isExcluded('my-command.md')).toBe(false);
    expect(isExcluded('obs-triage-inbox.md')).toBe(false);
    expect(isExcluded('vercel-react-best-practices')).toBe(false);
    expect(isExcluded('AGENTS.md')).toBe(false);
  });

  test('does not false-positive on gsd substring', () => {
    expect(isExcluded('my-gsd-thing')).toBe(false);
    expect(isExcluded('not-gsd')).toBe(false);
  });
});

describe('classifyEntry', () => {
  const isExcluded = createExclusionFilter();
  const canonicals = new Set(['my-plan.md', 'my-verify.md']);

  test('returns excluded for gsd-* items', () => {
    expect(classifyEntry('gsd-tools.cjs', canonicals, isExcluded)).toEqual({
      status: 'excluded',
    });
  });

  test('returns excluded for bare gsd directory', () => {
    expect(classifyEntry('gsd', canonicals, isExcluded)).toEqual({
      status: 'excluded',
    });
  });

  test('returns excluded for .sync-manifest.json', () => {
    expect(classifyEntry('.sync-manifest.json', canonicals, isExcluded)).toEqual({
      status: 'excluded',
    });
  });

  test('returns excluded for .gsd-file-manifest.json', () => {
    expect(classifyEntry('.gsd-file-manifest.json', canonicals, isExcluded)).toEqual({
      status: 'excluded',
    });
  });

  test('returns excluded for .DS_Store', () => {
    expect(classifyEntry('.DS_Store', canonicals, isExcluded)).toEqual({
      status: 'excluded',
    });
  });

  test('returns canonical for known items', () => {
    expect(classifyEntry('my-plan.md', canonicals, isExcluded)).toEqual({
      status: 'canonical',
    });
  });

  test('returns non-canonical for unknown items', () => {
    expect(classifyEntry('random-file.md', canonicals, isExcluded)).toEqual({
      status: 'non-canonical',
    });
  });

  test('exclusion takes priority over canonical', () => {
    const canonicalsWithGsd = new Set(['gsd-tools.cjs']);
    expect(classifyEntry('gsd-tools.cjs', canonicalsWithGsd, isExcluded)).toEqual({
      status: 'excluded',
    });
  });
});
