import { readFile, mkdir, unlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { writeSupportFiles } from '../infra/support-files';
import { loadManifest, saveManifest, updateManifestItem } from '../core/manifest';
import { createBackup, restoreAll, cleanupAll } from '../core/rollback';
import { formatDryRunResult, formatPushResult } from '../core/formatter';
import type { PushTargetResult } from '../core/formatter';
import { atomicWrite } from '../infra/atomic-write';
import { createExclusionFilter } from '../infra/exclusion';
import {
  ALL_TARGETS,
  createAdapter,
  hashContent,
  readCanonicalCommands,
  readCanonicalAgents,
  readCanonicalMCPServers,
  readCanonicalInstructions,
  readCanonicalSkills,
} from './canonical';
import { runCheck } from './sync-check';
import type { SyncOptions } from './canonical';
import type { DiffResult } from '../types';
import type { BackupInfo } from '../core/rollback';

export interface OrchestratorPushResult {
  diffs: DiffResult[];
  hasDrift: boolean;
  written: number;
  failed: number;
  rolledBack: boolean;
  output: string;
}

/**
 * Run the push operation: render + write all drifted items with rollback on failure.
 */
export async function runPush(options: SyncOptions = {}): Promise<OrchestratorPushResult> {
  const projectDir = options.projectDir ?? cwd();
  const targets = options.targets && options.targets.length > 0 ? options.targets : ALL_TARGETS;
  const isExcluded = createExclusionFilter(['gsd-*', '.acsync-backup-*']);

  const manifest = await loadManifest(projectDir);

  const [commands, agents, mcpServers, skills] = await Promise.all([
    readCanonicalCommands(projectDir, isExcluded),
    readCanonicalAgents(projectDir, isExcluded),
    readCanonicalMCPServers(projectDir),
    readCanonicalSkills(projectDir, isExcluded),
  ]);

  const checkResult = await runCheck({ ...options, projectDir, targets });

  if (!checkResult.hasDrift) {
    return {
      diffs: checkResult.diffs,
      hasDrift: false,
      written: 0,
      failed: 0,
      rolledBack: false,
      output: checkResult.output,
    };
  }

  if (options.dryRun) {
    const { output, hasDrift } = formatDryRunResult(checkResult.diffs, options.pretty ?? false);
    return {
      diffs: checkResult.diffs,
      hasDrift,
      written: 0,
      failed: 0,
      rolledBack: false,
      output,
    };
  }

  const allBackups: BackupInfo[] = [];
  const pushResults: PushTargetResult[] = [];
  let totalWritten = 0;
  let totalFailed = 0;
  let rolledBack = false;

  for (const diff of checkResult.diffs) {
    const target = diff.target;
    const adapter = createAdapter(target);
    const caps = adapter.getCapabilities();
    const writeOps = diff.operations.filter((op) => op.type === 'create' || op.type === 'update');
    const deleteOps = diff.operations.filter((op) => op.type === 'delete');

    if (writeOps.length === 0 && deleteOps.length === 0) {
      pushResults.push({ target, operations: diff.operations, success: true });
      continue;
    }

    const targetBackups: BackupInfo[] = [];
    let targetFailed = false;
    let errorMsg: string | undefined;
    const writtenPaths = new Set<string>();

    try {
      for (const op of writeOps) {
        if (!op.targetPath) continue;

        const alreadyWritten = writtenPaths.has(op.targetPath);

        if (!alreadyWritten) {
          const backup = await createBackup(op.targetPath);
          targetBackups.push(backup);
          allBackups.push(backup);

          let content: string;

          if (op.itemType === 'command') {
            const item = commands.find((c) => c.name === op.name);
            if (!item) continue;
            content = adapter.renderCommand(item).content;
          } else if (op.itemType === 'agent') {
            const item = agents.find((a) => a.name === op.name);
            if (!item) continue;
            content = adapter.renderAgent(item).content;
          } else if (op.itemType === 'mcp') {
            let existingContent: string | undefined;
            if (backup.existed) {
              try {
                existingContent = await readFile(backup.backupPath, 'utf-8');
              } catch {
                // Use no existing content
              }
            }
            content = adapter.renderMCPServers(mcpServers, existingContent);
          } else if (op.itemType === 'instruction') {
            const instructions = await readCanonicalInstructions(projectDir, target);
            if (!instructions) continue;
            content = adapter.renderInstructions(instructions.base, instructions.addendum);
          } else if (op.itemType === 'skill') {
            if (!caps.skills) continue;
            const item = skills.find((s) => s.name === op.name);
            if (!item) continue;
            content = adapter.renderSkill(item).content;
            if (item.supportFiles && item.supportFiles.length > 0) {
              const skillDir = join(adapter.getPaths().getSkillsDir(), item.name);
              await mkdir(skillDir, { recursive: true });
              await writeSupportFiles(skillDir, item.supportFiles);
            }
          } else {
            continue;
          }

          await atomicWrite(op.targetPath, content);
          writtenPaths.add(op.targetPath);
          totalWritten++;
        }

        const sourceHash = op.newHash ?? hashContent(op.targetPath);
        const targetHash = sourceHash;
        updateManifestItem(manifest, op.itemType, op.name, sourceHash, target, targetHash);
      }

      if (options.deleteStale) {
        for (const op of deleteOps) {
          if (!op.targetPath) continue;
          if (op.itemType === 'skill') {
            const skillMd = join(op.targetPath, 'SKILL.md');
            const backup = await createBackup(skillMd);
            targetBackups.push(backup);
            allBackups.push(backup);
            await rm(op.targetPath, { recursive: true, force: true });
          } else {
            const backup = await createBackup(op.targetPath);
            targetBackups.push(backup);
            allBackups.push(backup);
            await unlink(op.targetPath);
          }
        }
      }

      pushResults.push({ target, operations: diff.operations, success: true });
    } catch (err) {
      targetFailed = true;
      totalFailed++;
      errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`Push failed for ${target}: ${errorMsg}`);
      console.error('Rolling back...');

      await restoreAll(targetBackups);
      rolledBack = true;

      pushResults.push({
        target,
        operations: diff.operations,
        success: false,
        error: errorMsg,
      });
    }

    if (!targetFailed) {
      await cleanupAll(targetBackups);
    }
  }

  if (!rolledBack) {
    await saveManifest(manifest, projectDir);
  }

  const output = formatPushResult(pushResults, options.pretty ?? false);
  return {
    diffs: checkResult.diffs,
    hasDrift: totalWritten > 0 || totalFailed > 0,
    written: totalWritten,
    failed: totalFailed,
    rolledBack,
    output,
  };
}
