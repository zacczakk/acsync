import type { Manifest, ItemType, OperationType, Operation, DiffResult } from '../types';
import type { TargetName } from '../types';
import { getManifestHash } from './manifest';

export interface HashComparison {
  operation: OperationType;
  reason: string;
}

/**
 * 3-way hash comparison to determine sync operation.
 *
 * Cases:
 * 1. sourceHash null → skip (item not in source, safe mode — no delete)
 * 2. targetHash null → create (item not in target)
 * 3. all three match → skip (up to date)
 * 4. source === target → skip (up to date, manifest stale)
 * 5. source !== target → update (content changed)
 */
export function compareHashes(
  sourceHash: string | null,
  targetHash: string | null,
  manifestHash: string | null,
): HashComparison {
  // Case 1: Item not in source — safe mode, never delete
  if (sourceHash === null) {
    return {
      operation: 'skip',
      reason: 'Item not in source (safe mode - skipped)',
    };
  }

  // Case 2: Item not in target — create it
  if (targetHash === null) {
    return {
      operation: 'create',
      reason: 'Item not in target',
    };
  }

  // Case 3 & 4: Source matches target — up to date
  if (sourceHash === targetHash) {
    return {
      operation: 'skip',
      reason: 'Item up to date',
    };
  }

  // Case 5: Source differs from target — update
  void manifestHash; // manifestHash informs context but update is always the result when source != target
  return {
    operation: 'update',
    reason: 'Item content changed in source',
  };
}

export interface SourceItem {
  type: ItemType;
  name: string;
  hash: string;
  sourcePath?: string;
  targetPath?: string;
}

/**
 * Calculate diff for a single target by iterating source items and comparing hashes.
 */
export function calculateDiff(
  sourceItems: SourceItem[],
  targetHashes: Map<string, string>,
  manifest: Manifest,
  target: TargetName,
): DiffResult {
  const operations: Operation[] = [];
  let createCount = 0;
  let updateCount = 0;
  let skipCount = 0;

  for (const item of sourceItems) {
    const targetHash = targetHashes.get(`${item.type}/${item.name}`) ?? null;
    const manifestHash = getManifestHash(manifest, item.type, item.name, target);

    const comparison = compareHashes(item.hash, targetHash, manifestHash);

    const operation: Operation = {
      type: comparison.operation,
      itemType: item.type,
      name: item.name,
      target,
      reason: comparison.reason,
      newHash: item.hash,
    };

    if (targetHash !== null) {
      operation.oldHash = targetHash;
    }
    if (item.sourcePath !== undefined) {
      operation.sourcePath = item.sourcePath;
    }
    if (item.targetPath !== undefined) {
      operation.targetPath = item.targetPath;
    }

    operations.push(operation);

    switch (comparison.operation) {
      case 'create':
        createCount++;
        break;
      case 'update':
        updateCount++;
        break;
      case 'skip':
        skipCount++;
        break;
    }
  }

  return {
    target,
    operations,
    summary: { create: createCount, update: updateCount, skip: skipCount },
  };
}
