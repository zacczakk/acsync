import { describe, expect, test } from 'bun:test';
import { createExclusionFilter, classifyEntry } from '../exclusion';

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
});

describe('classifyEntry', () => {
  const isExcluded = createExclusionFilter(['gsd-*']);
  const canonicals = new Set(['zz-plan.md', 'zz-verify.md']);

  test('returns excluded for gsd-* items', () => {
    expect(classifyEntry('gsd-tools.cjs', canonicals, isExcluded)).toEqual({
      status: 'excluded',
    });
  });

  test('returns canonical for known items', () => {
    expect(classifyEntry('zz-plan.md', canonicals, isExcluded)).toEqual({
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
