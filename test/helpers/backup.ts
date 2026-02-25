import { cpSync, rmSync, mkdtempSync, existsSync, writeFileSync, unlinkSync, openSync, closeSync } from 'node:fs';
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
 * Filesystem-based mutex for withTargetBackup.
 *
 * Bun runs test files in parallel. Multiple files calling withTargetBackup
 * concurrently causes race conditions: Test A backs up, Test B backs up
 * (capturing Test A's mutations), restores clobber each other.
 *
 * This lock serializes all withTargetBackup calls across parallel test files
 * using O_EXCL atomic file creation.
 */
const LOCK_PATH = join(tmpdir(), 'acsync-target-backup.lock');
const LOCK_POLL_MS = 100;
const LOCK_TIMEOUT_MS = 120_000;

async function acquireLock(): Promise<void> {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const fd = openSync(LOCK_PATH, 'wx');
      writeFileSync(fd, `${process.pid}\n`);
      closeSync(fd);
      return;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
        await new Promise((r) => setTimeout(r, LOCK_POLL_MS));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`[withTargetBackup] Lock acquisition timed out after ${LOCK_TIMEOUT_MS}ms`);
}

function releaseLock(): void {
  try { unlinkSync(LOCK_PATH); } catch { /* already removed */ }
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

/**
 * Back up all 4 target config directories with cross-process locking.
 *
 * Serializes access so parallel test files don't race on the same real dirs.
 */
export async function withTargetBackup(fn: () => Promise<void>): Promise<void> {
  await acquireLock();
  try {
    await withBackup(TARGET_DIRS, fn);
  } finally {
    releaseLock();
  }
}
