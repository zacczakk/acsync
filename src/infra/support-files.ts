import { readFile, readdir, mkdir } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import type { SupportFile } from '../types';

/**
 * Read all files in a directory recursively, excluding a primary file.
 * Returns support files as relative-path / content pairs.
 * Ported from vsync's support-files.ts.
 */
export async function readSupportFiles(
  rootDir: string,
  exclude: string,
): Promise<SupportFile[]> {
  const result: SupportFile[] = [];
  await readRecursive(rootDir, rootDir, result, exclude);
  return result;
}

async function readRecursive(
  currentDir: string,
  rootDir: string,
  result: SupportFile[],
  exclude: string,
): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(currentDir);
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(currentDir, entry);
    const relativePath = relative(rootDir, fullPath).split(sep).join('/');

    // Check if directory via readdir attempt
    try {
      const sub = await readdir(fullPath);
      // It's a directory — recurse
      void sub;
      await readRecursive(fullPath, rootDir, result, exclude);
    } catch {
      // It's a file
      if (relativePath === exclude) continue;
      if (entry === '.DS_Store') continue;
      const content = await readFile(fullPath, 'utf-8');
      result.push({ relativePath, content });
    }
  }
}

/**
 * Write support files into a directory, creating subdirectories as needed.
 */
export async function writeSupportFiles(
  rootDir: string,
  supportFiles: SupportFile[],
): Promise<void> {
  for (const { relativePath, content } of supportFiles) {
    const filePath = join(rootDir, relativePath);
    await mkdir(dirname(filePath), { recursive: true });
    await Bun.write(filePath, content);
  }
}
