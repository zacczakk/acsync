import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface PackageMetadata {
  version?: string;
}

const packageMetadata = JSON.parse(
  readFileSync(join(import.meta.dir, '../../package.json'), 'utf-8'),
) as PackageMetadata;

export const CLI_VERSION = packageMetadata.version ?? '0.0.0';
