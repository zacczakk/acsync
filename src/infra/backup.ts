import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { BackupError } from '../errors';

export async function backupFile(filePath: string, backupDir: string): Promise<void> {
  try {
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (!exists) return;

    await mkdir(backupDir, { recursive: true });
    const dest = join(backupDir, basename(filePath));
    await copyFile(filePath, dest);
  } catch (err) {
    if (err instanceof BackupError) throw err;
    throw new BackupError(`Failed to backup file: ${filePath}`, {
      operation: 'backupFile',
      path: filePath,
      cause: err instanceof Error ? err : new Error(String(err)),
    });
  }
}

export async function pruneBackups(backupRoot: string, maxBackups: number): Promise<void> {
  try {
    let entries: string[];
    try {
      entries = await readdir(backupRoot);
    } catch {
      return;
    }

    entries.sort();

    if (entries.length <= maxBackups) return;

    const toRemove = entries.slice(0, entries.length - maxBackups);
    for (const entry of toRemove) {
      await rm(join(backupRoot, entry), { recursive: true, force: true });
    }
  } catch (err) {
    if (err instanceof BackupError) throw err;
    throw new BackupError(`Failed to prune backups: ${backupRoot}`, {
      operation: 'pruneBackups',
      path: backupRoot,
      cause: err instanceof Error ? err : new Error(String(err)),
    });
  }
}

export async function createBackupDir(backupRoot: string): Promise<string> {
  try {
    const now = new Date();
    const pad = (n: number, w = 2) => String(n).padStart(w, '0');
    const timestamp = [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
      'T',
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds()),
    ].join('');

    const dirPath = join(backupRoot, timestamp);
    await mkdir(dirPath, { recursive: true });
    return dirPath;
  } catch (err) {
    if (err instanceof BackupError) throw err;
    throw new BackupError(`Failed to create backup directory: ${backupRoot}`, {
      operation: 'createBackupDir',
      path: backupRoot,
      cause: err instanceof Error ? err : new Error(String(err)),
    });
  }
}
