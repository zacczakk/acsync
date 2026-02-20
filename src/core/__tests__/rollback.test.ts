import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createBackup, restoreBackup, cleanupBackup, restoreAll, cleanupAll } from '../rollback';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'rollback-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('createBackup', () => {
  test('returns existed=false when file does not exist', async () => {
    const info = await createBackup(join(tempDir, 'nonexistent.txt'));
    expect(info.existed).toBe(false);
    expect(info.backupPath).toBe('');
    expect(info.originalPath).toBe(join(tempDir, 'nonexistent.txt'));
  });

  test('creates backup copy when file exists', async () => {
    const filePath = join(tempDir, 'file.txt');
    await writeFile(filePath, 'original content');

    const info = await createBackup(filePath);

    expect(info.existed).toBe(true);
    expect(info.backupPath).not.toBe('');
    expect(existsSync(info.backupPath)).toBe(true);
    const backupContent = await readFile(info.backupPath, 'utf-8');
    expect(backupContent).toBe('original content');
  });

  test('backup filename includes .acsync-backup- prefix', async () => {
    const filePath = join(tempDir, 'file.txt');
    await writeFile(filePath, 'content');

    const info = await createBackup(filePath);

    expect(info.backupPath).toContain('.acsync-backup-');
    expect(info.backupPath).toContain('file.txt');
  });

  test('records timestamp', async () => {
    const before = new Date().toISOString();
    const info = await createBackup(join(tempDir, 'x.txt'));
    const after = new Date().toISOString();
    expect(info.timestamp >= before).toBe(true);
    expect(info.timestamp <= after).toBe(true);
  });
});

describe('restoreBackup', () => {
  test('deletes file when existed=false (newly created)', async () => {
    const filePath = join(tempDir, 'new-file.txt');
    await writeFile(filePath, 'was created during push');

    const backup = {
      originalPath: filePath,
      backupPath: '',
      existed: false,
      timestamp: new Date().toISOString(),
    };

    await restoreBackup(backup);

    expect(existsSync(filePath)).toBe(false);
  });

  test('restores file content when existed=true', async () => {
    const filePath = join(tempDir, 'existing.txt');
    await writeFile(filePath, 'original');

    const backup = await createBackup(filePath);

    // Simulate push modifying the file
    await writeFile(filePath, 'modified by push');

    await restoreBackup(backup);

    const restored = await readFile(filePath, 'utf-8');
    expect(restored).toBe('original');
  });

  test('does not throw when file already deleted (existed=false)', async () => {
    const backup = {
      originalPath: join(tempDir, 'already-gone.txt'),
      backupPath: '',
      existed: false,
      timestamp: new Date().toISOString(),
    };

    await expect(restoreBackup(backup)).resolves.toBeUndefined();
  });
});

describe('cleanupBackup', () => {
  test('removes backup file', async () => {
    const filePath = join(tempDir, 'file.txt');
    await writeFile(filePath, 'data');

    const backup = await createBackup(filePath);
    expect(existsSync(backup.backupPath)).toBe(true);

    await cleanupBackup(backup);

    expect(existsSync(backup.backupPath)).toBe(false);
  });

  test('no-op when backupPath is empty', async () => {
    const backup = {
      originalPath: join(tempDir, 'x.txt'),
      backupPath: '',
      existed: false,
      timestamp: new Date().toISOString(),
    };

    await expect(cleanupBackup(backup)).resolves.toBeUndefined();
  });
});

describe('restoreAll', () => {
  test('restores all backups and returns correct counts', async () => {
    const file1 = join(tempDir, 'file1.txt');
    const file2 = join(tempDir, 'file2.txt');
    await writeFile(file1, 'original1');
    await writeFile(file2, 'original2');

    const backup1 = await createBackup(file1);
    const backup2 = await createBackup(file2);

    // Simulate push modifications
    await writeFile(file1, 'modified1');
    await writeFile(file2, 'modified2');

    const result = await restoreAll([backup1, backup2]);

    expect(result.restored).toBe(2);
    expect(result.failed).toBe(0);
    expect(await readFile(file1, 'utf-8')).toBe('original1');
    expect(await readFile(file2, 'utf-8')).toBe('original2');
  });

  test('restores mix of existing and new files', async () => {
    const existingFile = join(tempDir, 'existing.txt');
    const newFile = join(tempDir, 'new.txt');

    await writeFile(existingFile, 'original');
    const backup1 = await createBackup(existingFile);
    const backup2 = await createBackup(newFile); // didn't exist

    // Simulate push: modify existing, create new
    await writeFile(existingFile, 'modified');
    await writeFile(newFile, 'created during push');

    await restoreAll([backup1, backup2]);

    expect(await readFile(existingFile, 'utf-8')).toBe('original');
    expect(existsSync(newFile)).toBe(false);
  });

  test('processes backups in reverse order', async () => {
    const file = join(tempDir, 'sequential.txt');
    await writeFile(file, 'v1');
    const b1 = await createBackup(file);
    await writeFile(file, 'v2');
    const b2 = await createBackup(file);
    await writeFile(file, 'v3');

    await restoreAll([b1, b2]);

    // Reverse order: b2 restored first (v2), then b1 (v1)
    const content = await readFile(file, 'utf-8');
    expect(content).toBe('v1');
  });
});

describe('cleanupAll', () => {
  test('removes all backup files', async () => {
    const file1 = join(tempDir, 'f1.txt');
    const file2 = join(tempDir, 'f2.txt');
    await writeFile(file1, 'a');
    await writeFile(file2, 'b');

    const b1 = await createBackup(file1);
    const b2 = await createBackup(file2);

    await cleanupAll([b1, b2]);

    expect(existsSync(b1.backupPath)).toBe(false);
    expect(existsSync(b2.backupPath)).toBe(false);
  });
});
