import { copyFile, unlink, mkdir, readFile, cp, rm, lstat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { atomicWrite } from '../infra/atomic-write';
import { RollbackError } from '../errors';

let backupCounter = 0;

export interface BackupInfo {
  originalPath: string;
  backupPath: string; // empty if file didn't exist
  existed: boolean;
  timestamp: string;
  directory?: boolean;
}

export async function createDirectoryBackup(directoryPath: string): Promise<BackupInfo> {
  const timestamp = new Date().toISOString();
  const exists = await lstat(directoryPath).then(() => true).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return false;
    throw error;
  });
  if (!exists) return { originalPath: directoryPath, backupPath: '', existed: false, timestamp, directory: true };
  const backupPath = join(tmpdir(), `metronome-rollback-${Date.now()}-${backupCounter++}-${basename(directoryPath)}`);
  await cp(directoryPath, backupPath, { recursive: true });
  return { originalPath: directoryPath, backupPath, existed: true, timestamp, directory: true };
}

export async function createBackup(filePath: string): Promise<BackupInfo> {
  const timestamp = new Date().toISOString();

  const file = Bun.file(filePath);
  const existed = await file.exists();

  if (!existed) {
    return {
      originalPath: filePath,
      backupPath: '',
      existed: false,
      timestamp,
    };
  }

  const file_ = basename(filePath);
  const backupDir = join(tmpdir(), `metronome-rollback-${Date.now()}`);
  const backupFileName = `${backupCounter++}-${file_}`;
  const backupPath = join(backupDir, backupFileName);

  try {
    await mkdir(backupDir, { recursive: true });
    await copyFile(filePath, backupPath);
  } catch (err) {
    throw new RollbackError(
      `Failed to create backup of ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
      {
        operation: 'createBackup',
        path: filePath,
        cause: err instanceof Error ? err : new Error(String(err)),
      },
    );
  }

  return {
    originalPath: filePath,
    backupPath,
    existed: true,
    timestamp,
  };
}

export async function restoreBackup(backup: BackupInfo): Promise<void> {
  if (backup.directory) {
    await rm(backup.originalPath, { recursive: true, force: true });
    if (backup.existed && backup.backupPath) {
      await cp(backup.backupPath, backup.originalPath, { recursive: true });
    }
    return;
  }
  if (!backup.existed) {
    // File was newly created — delete it
    await unlink(backup.originalPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
    return;
  }

  if (!backup.backupPath) {
    return;
  }

  const backupContent = await readFile(backup.backupPath, 'utf-8');
  await atomicWrite(backup.originalPath, backupContent);
}

export async function cleanupBackup(backup: BackupInfo): Promise<void> {
  if (!backup.backupPath) {
    return;
  }

  try {
    if (backup.directory) await rm(backup.backupPath, { recursive: true, force: true });
    else await unlink(backup.backupPath);
  } catch {
    // Swallow errors
  }
}

export async function restoreAll(
  backups: BackupInfo[],
): Promise<{ restored: number; failed: number }> {
  let restored = 0;
  let failed = 0;

  // Restore in reverse order (last written first)
  let item = 0;
  for (const backup of [...backups].reverse()) {
    item++;
    try {
      console.error(`  Restoring item ${item}`);
      await restoreBackup(backup);
      restored++;
    } catch {
      console.error(`  Failed to restore item ${item}`);
      failed++;
    }
  }

  return { restored, failed };
}

export async function cleanupAll(backups: BackupInfo[]): Promise<void> {
  for (const backup of backups) {
    await cleanupBackup(backup);
  }
}
