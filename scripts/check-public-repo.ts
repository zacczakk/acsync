import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export interface PublicRepoFile {
  path: string;
  content: string;
}

export interface PublicRepoLeak {
  rule: 'absolute-home-path' | 'private-skill-directory' | 'internal-reference' | 'personal-email' | 'secret-pattern' | 'ignored-sensitive-file' | 'history-sensitive-content';
  path: string;
}

const ABSOLUTE_HOME_PATH = /(?:\/Users\/[^/\s]+\/|\/home\/[^/\s]+\/|C:\\Users\\[^\\\s]+\\)/;
const PRIVATE_CLASSIFICATION_MARKER = /(?:^|\n)private:\s*true\s*$/m;
const INTERNAL_REFERENCE = /(?:\bmerck\b|merckgroup\.com|\buptimize\b|liquid-outcome-engine|\bm\d{6}\b)/i;
const PERSONAL_EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const ALLOWED_EMAILS = /[A-Z0-9._%+-]+@users\.noreply\.github\.com|noreply@anthropic\.com|[A-Z0-9._%+-]+@example\.(?:com|org|net)/gi;
const SECRET_PATTERN = /(?:BEGIN (?:RSA|EC|OPENSSH|PGP) PRIVATE KEY|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16}|\b(?:[A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD|PASSWD))\b[ \t]*[:=][ \t]*["']?(?!\$\{|\{env:)[A-Za-z0-9._+/=-]{20,})/i;
const HISTORY_SCAN_PATTERNS = [
  'merck',
  'uptimize',
  'liquid-outcome-engine',
  'm[0-9]{6}',
  'BEGIN RSA PRIVATE KEY',
  'BEGIN EC PRIVATE KEY',
  'BEGIN OPENSSH PRIVATE KEY',
  'BEGIN PGP PRIVATE KEY',
  'gh[pousr]_[A-Za-z0-9_]{20,}',
  'github_pat_[A-Za-z0-9_]{20,}',
  'xox[baprs]-[A-Za-z0-9-]{20,}',
  'AKIA[0-9A-Z]{16}',
];
const SCANNER_FILES = new Set(['scripts/check-public-repo.ts', 'scripts/__tests__/check-public-repo.test.ts']);

function hasPersonalEmail(content: string): boolean {
  return PERSONAL_EMAIL.test(content.replace(ALLOWED_EMAILS, ''));
}

function hasSensitiveContent(content: string): boolean {
  return INTERNAL_REFERENCE.test(content) || hasPersonalEmail(content) || SECRET_PATTERN.test(content);
}

export function findPublicRepoLeaks(files: readonly PublicRepoFile[]): PublicRepoLeak[] {
  return files.flatMap(({ path, content }) => {
    const segments = path.split('/');
    const isSkillDirectory = segments[0] === 'configs' && segments[1] === 'skills';
    const hasPrivateSkillDirectory = isSkillDirectory && PRIVATE_CLASSIFICATION_MARKER.test(content);
    const scanContent = !SCANNER_FILES.has(path);
    return [
      ...(ABSOLUTE_HOME_PATH.test(content) ? [{ rule: 'absolute-home-path' as const, path }] : []),
      ...(hasPrivateSkillDirectory ? [{ rule: 'private-skill-directory' as const, path }] : []),
      ...(scanContent && INTERNAL_REFERENCE.test(content) ? [{ rule: 'internal-reference' as const, path }] : []),
      ...(scanContent && hasPersonalEmail(content) ? [{ rule: 'personal-email' as const, path }] : []),
      ...(scanContent && SECRET_PATTERN.test(content) ? [{ rule: 'secret-pattern' as const, path }] : []),
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

function ignoredFiles(): string[] {
  const output = execFileSync('git', ['ls-files', '-z', '--others', '--ignored', '--exclude-standard'], { encoding: 'utf8' });
  return repositoryPaths(output, '').filter((path) => path === '.env' || path === '.claude/settings.local.json' || path.startsWith('.metronome/backups/'));
}

function historyLeaks(): PublicRepoLeak[] {
  try {
    const messages = execFileSync('git', ['log', '--all', '--format=%s%n%b'], { encoding: 'utf8' });
    if (hasSensitiveContent(messages)) {
      return [{ rule: 'history-sensitive-content', path: 'git history' }];
    }
  } catch {
    return [];
  }

  for (const pattern of HISTORY_SCAN_PATTERNS) {
    try {
      const output = execFileSync('git', ['log', '--all', '--full-history', '-i', `-G${pattern}`, '--format=%H', '--', ':!scripts/check-public-repo.ts', ':!scripts/__tests__/check-public-repo.test.ts'], { encoding: 'utf8' });
      if (output.trim() !== '') return [{ rule: 'history-sensitive-content', path: 'git history' }];
    } catch {
      continue;
    }
  }
  return [];
}

function main(): void {
  const files = repositoryFiles().flatMap((path) => {
    try {
      return [{ path, content: readFileSync(path, 'utf8') }];
    } catch {
      return [];
    }
  });
  const ignoredLeaks = ignoredFiles().flatMap((path) => {
    try {
      const content = readFileSync(path, 'utf8');
      return hasSensitiveContent(content)
        ? [{ rule: 'ignored-sensitive-file' as const, path }]
        : [];
    } catch {
      return [];
    }
  });
  const leaks = [...findPublicRepoLeaks(files), ...ignoredLeaks, ...historyLeaks()];
  for (const leak of leaks) console.error(`${leak.rule}: ${leak.path}`);
  if (leaks.length > 0) process.exitCode = 1;
}

if (import.meta.main) main();
