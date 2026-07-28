import { describe, expect, test } from 'bun:test';
import { findPublicRepoLeaks, repositoryPaths } from '../check-public-repo';

describe('findPublicRepoLeaks', () => {
  test('reports absolute home paths for every supported platform without printing matching content', () => {
    const leaks = findPublicRepoLeaks([
      { path: 'docs/macos.md', content: `path /${'Users'}/another-user/private` },
      { path: 'docs/linux.md', content: `path /${'home'}/another-user/private` },
      { path: 'docs/windows.md', content: `path C:\\${'Users'}\\another-user\\private` },
    ], 'alice');

    expect(leaks).toEqual([
      { rule: 'absolute-home-path', path: 'docs/macos.md' },
      { rule: 'absolute-home-path', path: 'docs/linux.md' },
      { rule: 'absolute-home-path', path: 'docs/windows.md' },
    ]);
  });

  test('reports known private skill directories under public configs', () => {
    const leaks = findPublicRepoLeaks([{ path: 'configs/skills/provider-docs/SKILL.md', content: 'safe' }], 'alice');

    expect(leaks).toEqual([{ rule: 'private-skill-directory', path: 'configs/skills/provider-docs/SKILL.md' }]);
  });

  test('reports private classification markers only under public skill directories', () => {
    const leaks = findPublicRepoLeaks([
      { path: 'configs/skills/future-private/SKILL.md', content: '---\nprivate: true\n---' },
      { path: 'docs/example.md', content: '---\nprivate: true\n---' },
    ], 'alice');

    expect(leaks).toEqual([{ rule: 'private-skill-directory', path: 'configs/skills/future-private/SKILL.md' }]);
  });

  test('allows general platform references', () => {
    const leaks = findPublicRepoLeaks([{ path: 'docs/example.md', content: 'Foundry and organization are documented.' }], 'alice');

    expect(leaks).toEqual([]);
  });
});

describe('repositoryPaths', () => {
  test('scans tracked and untracked files once', () => {
    expect(repositoryPaths('tracked.md\0shared.md\0', 'untracked.md\0shared.md\0')).toEqual([
      'tracked.md',
      'shared.md',
      'untracked.md',
    ]);
  });
});
