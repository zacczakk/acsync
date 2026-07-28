import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PRIVATE_SKILLS = new Set([
  'provider-docs',
  'foundry-local-development',
  'foundry-mediasets',
  'foundry-osdk-deploy',
  'foundry-react-app-dev',
]);

export interface PublicRepoFile {
  path: string;
  content: string;
}

export interface PublicRepoLeak {
  rule: 'absolute-home-path' | 'private-skill-directory';
  path: string;
}

const ABSOLUTE_HOME_PATH = /(?:\/Users\/[^/\s]+\/|\/home\/[^/\s]+\/|C:\\Users\\[^\\\s]+\\)/;
const PRIVATE_CLASSIFICATION_MARKER = /(?:^|\n)private:\s*true\s*$/m;

export function findPublicRepoLeaks(files: readonly PublicRepoFile[], _username?: string): PublicRepoLeak[] {
  return files.flatMap(({ path, content }) => {
    const segments = path.split('/');
    const isSkillDirectory = segments[0] === 'configs' && segments[1] === 'skills';
    const hasPrivateSkillDirectory = isSkillDirectory && (
      PRIVATE_SKILLS.has(segments[2] ?? '') || PRIVATE_CLASSIFICATION_MARKER.test(content)
    );
    return [
      ...(ABSOLUTE_HOME_PATH.test(content) ? [{ rule: 'absolute-home-path' as const, path }] : []),
      ...(hasPrivateSkillDirectory ? [{ rule: 'private-skill-directory' as const, path }] : []),
    ];
  });
}

export function repositoryPaths(trackedOutput: string, untrackedOutput: string): string[] {
  return [...new Set(`${trackedOutput}${untrackedOutput}`.split('\0').filter(Boolean))];
}

function repositoryFiles(): string[] {
  const tracked = execFileSync('git', ['ls-files', '-z', '--cached'], { encoding: 'utf8' });
  const untracked = execFileSync('git', ['ls-files', '-z', '--others', '--exclude-standard'], { encoding: 'utf8' });
  return repositoryPaths(tracked, untracked);
}

function main(): void {
  const files = repositoryFiles().flatMap((path) => {
    try {
      return [{ path, content: readFileSync(path, 'utf8') }];
    } catch {
      return [];
    }
  });
  const leaks = findPublicRepoLeaks(files);
  for (const leak of leaks) console.error(`${leak.rule}: ${leak.path}`);
  if (leaks.length > 0) process.exitCode = 1;
}

if (import.meta.main) main();
