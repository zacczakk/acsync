import { readFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { atomicWrite } from '../infra/atomic-write';
import { ManifestError } from '../errors';
import type { Manifest, ManifestItem, ItemType, TargetStatus } from '../types';
import type { TargetName } from '../types';

export function getManifestPath(projectDir?: string): string {
  return join(projectDir ?? cwd(), '.acsync', 'manifest.json');
}

export function createEmptyManifest(): Manifest {
  return {
    version: '1.0.0',
    lastSynced: new Date().toISOString(),
    items: {},
  };
}

export async function loadManifest(projectDir?: string): Promise<Manifest> {
  const manifestPath = getManifestPath(projectDir);

  try {
    const content = await readFile(manifestPath, 'utf-8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return createEmptyManifest();
    }

    const manifest = parsed as Manifest;
    if (!manifest.version || !manifest.items) {
      return createEmptyManifest();
    }

    return manifest;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return createEmptyManifest();
    }
    if (error instanceof ManifestError) throw error;
    throw new ManifestError(
      `Failed to load manifest: ${error instanceof Error ? error.message : String(error)}`,
      {
        operation: 'loadManifest',
        path: manifestPath,
        cause: error instanceof Error ? error : new Error(String(error)),
      },
    );
  }
}

export async function saveManifest(manifest: Manifest, projectDir?: string): Promise<void> {
  const manifestPath = getManifestPath(projectDir);
  const acsyncDir = join(projectDir ?? cwd(), '.acsync');
  const backupDir = join(acsyncDir, 'backups');

  manifest.lastSynced = new Date().toISOString();
  const content = JSON.stringify(manifest, null, 2) + '\n';

  try {
    await mkdir(acsyncDir, { recursive: true });
    await atomicWrite(manifestPath, content, backupDir);
  } catch (error) {
    if (error instanceof ManifestError) throw error;
    throw new ManifestError(
      `Failed to save manifest: ${error instanceof Error ? error.message : String(error)}`,
      {
        operation: 'saveManifest',
        path: manifestPath,
        cause: error instanceof Error ? error : new Error(String(error)),
      },
    );
  }
}

export function updateManifestItem(
  manifest: Manifest,
  type: ItemType,
  name: string,
  sourceHash: string,
  target: TargetName,
  targetHash: string,
): void {
  const key = `${type}/${name}`;
  const now = new Date().toISOString();

  if (!manifest.items[key]) {
    manifest.items[key] = {
      type,
      name,
      sourceHash,
      lastSynced: now,
      targets: {},
    } satisfies ManifestItem;
  }

  const item = manifest.items[key];
  item.sourceHash = sourceHash;
  item.lastSynced = now;
  item.targets[target] = {
    hash: targetHash,
    lastSynced: now,
  } satisfies TargetStatus;
}

export function getManifestHash(
  manifest: Manifest,
  type: ItemType,
  name: string,
  target: TargetName,
): string | null {
  const key = `${type}/${name}`;
  return manifest.items[key]?.targets[target]?.hash ?? null;
}
