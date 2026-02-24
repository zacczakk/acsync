import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readSupportFiles, writeSupportFiles } from '../support-files';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'support-files-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('readSupportFiles', () => {
  test('returns non-excluded files with correct relativePath and content', async () => {
    await writeFile(join(tempDir, 'SKILL.md'), '# Primary\n');
    await writeFile(join(tempDir, 'README.md'), '# Readme\n');

    const files = await readSupportFiles(tempDir, 'SKILL.md');

    expect(files).toHaveLength(1);
    expect(files[0].relativePath).toBe('README.md');
    expect(files[0].content).toBe('# Readme\n');
  });

  test('excludes the primary file specified by name', async () => {
    await writeFile(join(tempDir, 'SKILL.md'), '# Primary\n');
    await writeFile(join(tempDir, 'other.txt'), 'other\n');

    const files = await readSupportFiles(tempDir, 'SKILL.md');
    const names = files.map((f) => f.relativePath);

    expect(names).not.toContain('SKILL.md');
    expect(names).toContain('other.txt');
  });

  test('excludes .DS_Store files', async () => {
    await writeFile(join(tempDir, '.DS_Store'), '\x00\x00');
    await writeFile(join(tempDir, 'keep.md'), 'keep\n');

    const files = await readSupportFiles(tempDir, 'SKILL.md');
    const names = files.map((f) => f.relativePath);

    expect(names).not.toContain('.DS_Store');
    expect(names).toContain('keep.md');
  });

  test('reads nested files with forward-slash relative paths', async () => {
    const rulesDir = join(tempDir, 'rules');
    await mkdir(rulesDir, { recursive: true });
    await writeFile(join(tempDir, 'SKILL.md'), '# Skill\n');
    await writeFile(join(rulesDir, 'foo.md'), 'rule content\n');

    const files = await readSupportFiles(tempDir, 'SKILL.md');

    expect(files).toHaveLength(1);
    expect(files[0].relativePath).toBe('rules/foo.md');
    expect(files[0].content).toBe('rule content\n');
  });

  test('returns empty array when directory does not exist', async () => {
    const files = await readSupportFiles(join(tempDir, 'nonexistent'), 'SKILL.md');
    expect(files).toEqual([]);
  });

  test('returns empty array when only the excluded file exists', async () => {
    await writeFile(join(tempDir, 'SKILL.md'), '# Only file\n');

    const files = await readSupportFiles(tempDir, 'SKILL.md');
    expect(files).toEqual([]);
  });
});

describe('writeSupportFiles', () => {
  test('writes flat files with correct content', async () => {
    const outDir = join(tempDir, 'out');
    await mkdir(outDir, { recursive: true });

    await writeSupportFiles(outDir, [
      { relativePath: 'README.md', content: '# Hello\n' },
      { relativePath: 'notes.txt', content: 'some notes\n' },
    ]);

    const readme = await readFile(join(outDir, 'README.md'), 'utf-8');
    expect(readme).toBe('# Hello\n');

    const notes = await readFile(join(outDir, 'notes.txt'), 'utf-8');
    expect(notes).toBe('some notes\n');
  });

  test('creates nested directories as needed', async () => {
    const outDir = join(tempDir, 'out');
    await mkdir(outDir, { recursive: true });

    await writeSupportFiles(outDir, [
      { relativePath: 'rules/deep/file.md', content: 'deep content\n' },
    ]);

    const content = await readFile(join(outDir, 'rules', 'deep', 'file.md'), 'utf-8');
    expect(content).toBe('deep content\n');
  });

  test('round-trips with readSupportFiles', async () => {
    // Write support files into a dir
    const original = [
      { relativePath: 'AGENTS.md', content: '# Agent\n' },
      { relativePath: 'rules/a.md', content: 'rule a\n' },
      { relativePath: 'rules/b.md', content: 'rule b\n' },
    ];

    const outDir = join(tempDir, 'roundtrip');
    await mkdir(outDir, { recursive: true });
    // Also write the primary file (would be excluded on read)
    await writeFile(join(outDir, 'SKILL.md'), '# Primary\n');
    await writeSupportFiles(outDir, original);

    // Read them back excluding SKILL.md
    const read = await readSupportFiles(outDir, 'SKILL.md');
    const sorted = [...read].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    const expectedSorted = [...original].sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    expect(sorted).toEqual(expectedSorted);
  });
});
