import { copyFile, unlink, mkdir, readFile } from 'node:fs/promises';
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
  const backupDir = join(tmpdir(), `acsync-rollback-${Date.now()}`);
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
    await atomicWrite(backup.originalPath, backupContent);
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
