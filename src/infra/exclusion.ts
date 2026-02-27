/**
 * Canonical exclusion patterns — single source of truth.
 * Matches sync-spec.md §Exclusion Rules + acsync internal backups.
 *
 * Never touch these during sync:
 * - gsd-*                   GSD-managed commands/agents
 * - gsd                     GSD command subdirectory (bare dirname)
 * - .sync-manifest.json     GSD artifact
 * - .gsd-file-manifest.json GSD artifact
 * - .DS_Store               macOS junk
 * - .acsync-backup-*        acsync internal backups
 */
export const EXCLUSION_PATTERNS = [
  'gsd-*',
  'gsd',
  '.acsync-backup-*',
  '.sync-manifest.json',
  '.gsd-file-manifest.json',
  '.DS_Store',
] as const;

export function createExclusionFilter(patterns: readonly string[] = EXCLUSION_PATTERNS): (name: string) => boolean {
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
