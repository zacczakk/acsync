import { copyFile, unlink, mkdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { atomicWrite } from '../infra/atomic-write';
import { RollbackError } from '../errors';

export interface BackupInfo {
  originalPath: string;
  backupPath: string; // empty if file didn't exist
  existed: boolean;
  timestamp: string;
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

  const dir = dirname(filePath);
  const file_ = basename(filePath);
  const backupFileName = `.acsync-backup-${Date.now()}-${file_}`;
  const backupPath = join(dir, backupFileName);

  try {
    await mkdir(dir, { recursive: true });
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
  if (!backup.existed) {
    // File was newly created — delete it
    try {
      await unlink(backup.originalPath);
    } catch {
      // Best-effort during failure recovery
    }
    return;
  }

  if (!backup.backupPath) {
    return;
  }

  try {
    const backupContent = await readFile(backup.backupPath, 'utf-8');
    const backupDir = join(dirname(backup.originalPath), '.acsync', 'restore-backups');
    await atomicWrite(backup.originalPath, backupContent, backupDir);
  } catch {
    // Swallow errors — best-effort during failure recovery
  }
}

export async function cleanupBackup(backup: BackupInfo): Promise<void> {
  if (!backup.backupPath) {
    return;
  }

  try {
    await unlink(backup.backupPath);
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
  for (const backup of [...backups].reverse()) {
    try {
      console.error(`  Restoring: ${backup.originalPath}`);
      await restoreBackup(backup);
      restored++;
    } catch {
      console.error(`  Failed to restore: ${backup.originalPath}`);
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
