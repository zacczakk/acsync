import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { backupFile } from '../backup';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'backup-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('backupFile', () => {
  test('copies file to backup directory', async () => {
    const srcPath = join(tempDir, 'original.txt');
    await writeFile(srcPath, 'original content');

    const backupDir = join(tempDir, 'backup');
    await backupFile(srcPath, backupDir);

    const backedUp = await readFile(join(backupDir, 'original.txt'), 'utf-8');
    expect(backedUp).toBe('original content');
  });

  test('is no-op when source file does not exist', async () => {
    const backupDir = join(tempDir, 'backup');
    await backupFile(join(tempDir, 'nope.txt'), backupDir);

    expect(existsSync(backupDir)).toBe(false);
  });

  test('creates backup directory if it does not exist', async () => {
    const srcPath = join(tempDir, 'file.txt');
    await writeFile(srcPath, 'data');

    const backupDir = join(tempDir, 'deep', 'nested', 'backup');
    await backupFile(srcPath, backupDir);

    expect(existsSync(join(backupDir, 'file.txt'))).toBe(true);
  });
});
