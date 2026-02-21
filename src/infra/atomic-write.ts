import { randomBytes } from 'node:crypto';
import { writeFile, rename, mkdir, unlink, open } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { AtomicWriteError } from '../errors';

export async function atomicWrite(
  targetPath: string,
  content: string | Uint8Array,
): Promise<void> {
  const dir = dirname(targetPath);
  const tmpSuffix = randomBytes(8).toString('hex');
  const tmpPath = join(dir, `.tmp-${tmpSuffix}`);

  let fileHandle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    await mkdir(dir, { recursive: true });

    await writeFile(tmpPath, content);

    fileHandle = await open(tmpPath, 'r+');
    await fileHandle.sync();
    await fileHandle.close();
    fileHandle = undefined;

    await rename(tmpPath, targetPath);
  } catch (err) {
    if (fileHandle) {
      try {
        await fileHandle.close();
      } catch {
        // best-effort close
      }
    }

    try {
      await unlink(tmpPath);
    } catch {
      // best-effort cleanup
    }

    if (err instanceof AtomicWriteError) throw err;
    throw new AtomicWriteError(`Failed to write file atomically: ${targetPath}`, {
      operation: 'atomicWrite',
      path: targetPath,
      cause: err instanceof Error ? err : new Error(String(err)),
    });
  }
}
