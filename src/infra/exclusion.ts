export function createExclusionFilter(patterns: string[]): (name: string) => boolean {
  const globs = patterns.map((p) => new Bun.Glob(p));

  return (name: string): boolean => {
    const basename = name.split('/').pop() ?? name;
    return globs.some((g) => g.match(basename));
  };
}

export type EntryStatus = 'canonical' | 'excluded' | 'non-canonical';

export function classifyEntry(
  name: string,
  canonicalNames: Set<string>,
  isExcluded: (name: string) => boolean,
): { status: EntryStatus } {
  if (isExcluded(name)) {
    return { status: 'excluded' };
  }
  if (canonicalNames.has(name)) {
    return { status: 'canonical' };
  }
  return { status: 'non-canonical' };
}
