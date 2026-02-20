import { HashError } from '../errors';

export async function hashFile(filePath: string): Promise<string> {
  try {
    const bytes = await Bun.file(filePath).bytes();
    const hasher = new Bun.CryptoHasher('sha256');
    hasher.update(bytes);
    return hasher.digest('hex');
  } catch (err) {
    throw new HashError(`Failed to hash file: ${filePath}`, {
      operation: 'hashFile',
      path: filePath,
      cause: err instanceof Error ? err : new Error(String(err)),
    });
  }
}

export async function hashDirectory(
  dirPath: string,
  isExcluded: (name: string) => boolean,
): Promise<string> {
  try {
    const glob = new Bun.Glob('**/*');
    const entries: Array<{ relativePath: string; contentHash: string }> = [];

    for await (const relativePath of glob.scan({ cwd: dirPath, dot: true })) {
      if (isExcluded(relativePath)) {
        continue;
      }

      const fullPath = `${dirPath}/${relativePath}`;
      const stat = await Bun.file(fullPath).exists();
      if (!stat) continue;

      const fileInfo = Bun.file(fullPath);
      const size = fileInfo.size;

      // Skip directories (Bun.Glob with scan should only yield files, but guard)
      if (size === 0) {
        const bytes = await fileInfo.bytes();
        const fileHasher = new Bun.CryptoHasher('sha256');
        fileHasher.update(bytes);
        entries.push({ relativePath, contentHash: fileHasher.digest('hex') });
        continue;
      }

      const bytes = await fileInfo.bytes();
      const fileHasher = new Bun.CryptoHasher('sha256');
      fileHasher.update(bytes);
      entries.push({ relativePath, contentHash: fileHasher.digest('hex') });
    }

    // Sort by relativePath using byte-order comparison (not locale-dependent)
    entries.sort((a, b) =>
      a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0,
    );

    const compositeHasher = new Bun.CryptoHasher('sha256');
    for (const entry of entries) {
      compositeHasher.update(entry.relativePath);
      compositeHasher.update(entry.contentHash);
    }

    return compositeHasher.digest('hex');
  } catch (err) {
    if (err instanceof HashError) throw err;
    throw new HashError(`Failed to hash directory: ${dirPath}`, {
      operation: 'hashDirectory',
      path: dirPath,
      cause: err instanceof Error ? err : new Error(String(err)),
    });
  }
}
