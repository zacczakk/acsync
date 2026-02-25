import { cpSync, rmSync, mkdtempSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import os from 'node:os';
import path from 'node:path';

/** All 4 target config directories that acsync writes to */
export const TARGET_DIRS = [
  path.join(os.homedir(), '.claude'),
  path.join(os.homedir(), '.config', 'opencode'),
  path.join(os.homedir(), '.gemini'),
  path.join(os.homedir(), '.codex'),
];

interface BackupEntry {
  dir: string;
  backupPath: string;
  existed: boolean;
}

/**
 * Back up directory trees before test execution, restore after — even on failure.
 *
 * Designed for wrapping describe blocks or use in beforeAll/afterAll.
 * Uses node:fs cpSync/rmSync — independent of production rollback.ts.
 */
export async function withBackup(dirs: string[], fn: () => Promise<void>): Promise<void> {
  const entries: BackupEntry[] = [];
  const tempRoot = mkdtempSync(join(tmpdir(), 'acsync-test-backup-'));

  // Create backups
  for (const dir of dirs) {
    const existed = existsSync(dir);
    const sanitized = dir.replace(/[/\\:]/g, '_');
    const backupPath = join(tempRoot, sanitized);

    if (existed) {
      cpSync(dir, backupPath, { recursive: true });
    }

    entries.push({ dir, backupPath, existed });
  }

  try {
    await fn();
  } finally {
    // Restore all directories, even if fn() threw
    for (const entry of entries) {
      try {
        if (entry.existed) {
          // Had content: remove whatever test wrote, restore original
          rmSync(entry.dir, { recursive: true, force: true });
          cpSync(entry.backupPath, entry.dir, { recursive: true });
        } else {
          // Didn't exist before: clean up whatever test created
          rmSync(entry.dir, { recursive: true, force: true });
        }
      } catch (err) {
        console.warn(`[withBackup] Failed to restore ${entry.dir}: ${err}`);
        // Continue restoring remaining dirs
      }
    }

    // Clean up temp backup dir
    try {
      rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }
}

/** Convenience: back up all 4 target config directories */
export async function withTargetBackup(fn: () => Promise<void>): Promise<void> {
  return withBackup(TARGET_DIRS, fn);
}
