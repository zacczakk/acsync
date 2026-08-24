import { describe, expect, test } from 'bun:test';
import { findPublicRepoLeaks, repositoryPaths } from '../check-public-repo';

describe('findPublicRepoLeaks', () => {
  test('reports absolute home paths for every supported platform without printing matching content', () => {
    const leaks = findPublicRepoLeaks([
      { path: 'docs/macos.md', content: `path /${'Users'}/another-user/private` },
      { path: 'docs/linux.md', content: `path /${'home'}/another-user/private` },
      { path: 'docs/windows.md', content: `path C:\\${'Users'}\\another-user\\private` },
    ]);

    expect(leaks).toEqual([
      { rule: 'absolute-home-path', path: 'docs/macos.md' },
      { rule: 'absolute-home-path', path: 'docs/linux.md' },
      { rule: 'absolute-home-path', path: 'docs/windows.md' },
    ]);
  });

  test('reports private classification markers under public skills', () => {
    const leaks = findPublicRepoLeaks([{ path: 'configs/skills/future-private/SKILL.md', content: '---\nprivate: true\n---' }]);

    expect(leaks).toEqual([{ rule: 'private-skill-directory', path: 'configs/skills/future-private/SKILL.md' }]);
  });

  test('reports private classification markers only under public skill directories', () => {
    const leaks = findPublicRepoLeaks([
      { path: 'configs/skills/future-private/SKILL.md', content: '---\nprivate: true\n---' },
      { path: 'docs/example.md', content: '---\nprivate: true\n---' },
    ]);

    expect(leaks).toEqual([{ rule: 'private-skill-directory', path: 'configs/skills/future-private/SKILL.md' }]);
  });

  test('allows generic platform references', () => {
    const leaks = findPublicRepoLeaks([{ path: 'docs/example.md', content: 'Foundry is documented.' }]);

    expect(leaks).toEqual([]);
  });

  test('reports internal company references', () => {
    const leaks = findPublicRepoLeaks([{ path: 'docs/example.md', content: 'Internal platform details.' }]);

    expect(leaks).toEqual([]);
    expect(findPublicRepoLeaks([{ path: 'docs/example.md', content: 'Merck platform details.' }])).toEqual([
      { rule: 'internal-reference', path: 'docs/example.md' },
    ]);
  });

  test('reports personal email addresses', () => {
    expect(findPublicRepoLeaks([{ path: 'docs/example.md', content: 'Contact alice@example.com.' }])).toEqual([]);
    expect(findPublicRepoLeaks([{ path: 'docs/example.md', content: 'Contact alice@company.test.' }])).toEqual([
      { rule: 'personal-email', path: 'docs/example.md' },
    ]);
  });

  test('reports literal secret assignments while allowing env references', () => {
    expect(findPublicRepoLeaks([{ path: 'config.json', content: '"API_KEY": "${API_KEY}"' }])).toEqual([]);
    expect(findPublicRepoLeaks([{ path: 'config.json', content: 'API_KEY=abcdefghijklmnopqrstuvwxyz' }])).toEqual([
      { rule: 'secret-pattern', path: 'config.json' },
    ]);
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
