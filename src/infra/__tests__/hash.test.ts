import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { writeFile, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { hashFile, hashDirectory } from '../hash';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'hash-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('hashFile', () => {
  test('returns same hex string for same content across calls', async () => {
    const filePath = join(tempDir, 'test.txt');
    await writeFile(filePath, 'hello world');

    const hash1 = await hashFile(filePath);
    const hash2 = await hashFile(filePath);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  test('returns different hex string for different content', async () => {
    const file1 = join(tempDir, 'a.txt');
    const file2 = join(tempDir, 'b.txt');
    await writeFile(file1, 'hello');
    await writeFile(file2, 'world');

    const hash1 = await hashFile(file1);
    const hash2 = await hashFile(file2);

    expect(hash1).not.toBe(hash2);
  });

  test('throws HashError for non-existent file', async () => {
    const filePath = join(tempDir, 'nope.txt');
    await expect(hashFile(filePath)).rejects.toThrow('Failed to hash file');
  });
});

describe('hashDirectory', () => {
  const noExclusions = () => false;

  test('returns same hex string regardless of file creation order', async () => {
    // Create files in one order
    const dir1 = join(tempDir, 'dir1');
    await mkdir(dir1);
    await writeFile(join(dir1, 'b.txt'), 'bravo');
    await writeFile(join(dir1, 'a.txt'), 'alpha');

    // Create files in reverse order
    const dir2 = join(tempDir, 'dir2');
    await mkdir(dir2);
    await writeFile(join(dir2, 'a.txt'), 'alpha');
    await writeFile(join(dir2, 'b.txt'), 'bravo');

    const hash1 = await hashDirectory(dir1, noExclusions);
    const hash2 = await hashDirectory(dir2, noExclusions);

    expect(hash1).toBe(hash2);
  });

  test('excludes files matching exclusion filter', async () => {
    const dir1 = join(tempDir, 'with-excluded');
    await mkdir(dir1);
    await writeFile(join(dir1, 'a.txt'), 'alpha');
    await writeFile(join(dir1, 'gsd-tools.cjs'), 'excluded content');

    const dir2 = join(tempDir, 'without-excluded');
    await mkdir(dir2);
    await writeFile(join(dir2, 'a.txt'), 'alpha');

    const isExcluded = (name: string) => name.startsWith('gsd-');
    const hash1 = await hashDirectory(dir1, isExcluded);
    const hash2 = await hashDirectory(dir2, noExclusions);

    expect(hash1).toBe(hash2);
  });

  test('changes hash when a file is renamed', async () => {
    const dir = join(tempDir, 'rename-test');
    await mkdir(dir);
    await writeFile(join(dir, 'original.txt'), 'content');

    const hash1 = await hashDirectory(dir, noExclusions);

    await rename(join(dir, 'original.txt'), join(dir, 'renamed.txt'));

    const hash2 = await hashDirectory(dir, noExclusions);

    expect(hash1).not.toBe(hash2);
  });

  test('empty directory returns consistent hash', async () => {
    const dir1 = join(tempDir, 'empty1');
    const dir2 = join(tempDir, 'empty2');
    await mkdir(dir1);
    await mkdir(dir2);

    const hash1 = await hashDirectory(dir1, noExclusions);
    const hash2 = await hashDirectory(dir2, noExclusions);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });
});
