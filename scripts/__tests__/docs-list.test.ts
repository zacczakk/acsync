import { afterEach, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

describe('docs-list', () => {
  test('compiled binary lists docs from the current repo instead of Bun virtual FS', () => {
    const binaryDir = makeTempDir('docs-list-bin-');
    const binaryPath = join(binaryDir, 'docs-list');
    const build = spawnSync('bun', ['build', 'scripts/docs-list.ts', '--compile', '--outfile', binaryPath], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(build.status).toBe(0);

    const projectDir = makeTempDir('docs-list-project-');
    const docsDir = join(projectDir, 'docs');
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(
      join(docsDir, 'guide.md'),
      '---\nsummary: Temp project guide\nread_when:\n  - checking docs-list\n---\n\n# Guide\n',
    );

    const result = spawnSync(binaryPath, { cwd: projectDir, encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('guide.md - Temp project guide');
    expect(result.stdout).toContain('Read when: checking docs-list');
  });
});
