import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { writeFile, readFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { backupFile, pruneBackups, createBackupDir } from '../backup';

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

describe('pruneBackups', () => {
  test('keeps only maxBackups entries and removes oldest', async () => {
    const root = join(tempDir, 'backups');
    await mkdir(root);

    const dirs = ['20260101T000000', '20260102T000000', '20260103T000000', '20260104T000000'];
    for (const d of dirs) {
      await mkdir(join(root, d));
      await writeFile(join(root, d, 'file.txt'), d);
    }

    await pruneBackups(root, 2);

    const remaining = await readdir(root);
    remaining.sort();
    expect(remaining).toEqual(['20260103T000000', '20260104T000000']);
  });

  test('is no-op when fewer than maxBackups entries exist', async () => {
    const root = join(tempDir, 'backups');
    await mkdir(root);
    await mkdir(join(root, '20260101T000000'));

    await pruneBackups(root, 5);

    const remaining = await readdir(root);
    expect(remaining).toEqual(['20260101T000000']);
  });

  test('is no-op when backup root does not exist', async () => {
    await pruneBackups(join(tempDir, 'nonexistent'), 5);
    // No error thrown
  });
});

describe('createBackupDir', () => {
  test('returns path with correct timestamp format', async () => {
    const root = join(tempDir, 'backups');
    const result = await createBackupDir(root);

    const dirName = result.split('/').pop();
    expect(dirName).toMatch(/^\d{8}T\d{6}$/);
    expect(existsSync(result)).toBe(true);
  });
});
