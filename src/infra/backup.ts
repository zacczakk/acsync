import { copyFile, mkdir } from 'node:fs/promises';
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
