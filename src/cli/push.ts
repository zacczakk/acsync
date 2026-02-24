#!/usr/bin/env bun
import { readFile, mkdir, unlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Command } from 'commander';
import { writeSupportFiles } from '../infra/support-files';
import { loadManifest, saveManifest, updateManifestItem } from '../core/manifest';
import { createBackup, restoreAll, cleanupAll } from '../core/rollback';
import { formatDryRunResult, formatPushResult } from '../core/formatter';
import type { PushTargetResult } from '../core/formatter';
import { atomicWrite } from '../infra/atomic-write';
import { createExclusionFilter } from '../infra/exclusion';
import {
  ALL_TARGETS,
  PROJECT_ROOT,
  createAdapter,
  hashContent,
  readCanonicalCommands,
  readCanonicalAgents,
  readCanonicalMCPServers,
  readCanonicalInstructions,
  readCanonicalSkills,
  readCanonicalSettings,
} from './canonical';
import { runCheck } from './check';
import { confirm, mapTargets, mapTypes, collect, validateTargets, validateTypes } from './cli-helpers';
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
  const projectDir = options.projectDir ?? PROJECT_ROOT;
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
            const instructionContent = await readCanonicalInstructions(projectDir);
            if (!instructionContent) continue;
            content = adapter.renderInstructions(instructionContent);
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
          } else if (op.itemType === 'settings') {
            if (!caps.settings) continue;
            const settings = await readCanonicalSettings(projectDir, target);
            if (!settings) continue;
            let existingContent: string | undefined;
            if (backup.existed) {
              try {
                existingContent = await readFile(backup.backupPath, 'utf-8');
              } catch {
                // Use no existing content
              }
            }
            content = adapter.renderSettings(settings, existingContent);
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

export const pushCommand = new Command('push')
  .description(
    `Render canonical configs and write them to target CLI locations.

Runs check first, shows a plan, prompts for confirmation, then atomically writes
rendered files. Creates backups before each write; rolls back all changes on failure.

Without --force, shows drift and asks for confirmation before writing.
With --delete, also removes stale target files not present in canonical source.

Examples:
  acsync push                           Check, confirm, then push all
  acsync push --force                   Push without confirmation
  acsync push --dry-run                 Show plan without writing anything
  acsync push --delete                  Push and remove stale target files
  acsync push -t claude --type commands Push commands to Claude Code only
  acsync push --force --delete          Full sync: push all + clean stale`)
  .option('--pretty', 'Human-readable colored output (default: JSON)')
  .option('--json', 'Output JSON (default behavior, explicit for scripts)')
  .option('-t, --target <name>', 'Scope to specific target (repeatable): claude, gemini, codex, opencode', collect, [] as string[])
  .option('--type <name>', 'Scope to config type (repeatable): commands, agents, mcps, instructions, skills, settings', collect, [] as string[])
  .option('--dry-run', 'Show execution plan without writing')
  .option('--force', 'Skip confirmation prompt')
  .option('--delete', 'Delete stale target files not in canonical source (default: skip)')
  .action(
    async (options: {
      pretty?: boolean;
      target: string[];
      type: string[];
      dryRun?: boolean;
      force?: boolean;
      delete?: boolean;
    }) => {
      try {
        validateTargets(options.target);
        validateTypes(options.type);

        const syncOpts = {
          targets: mapTargets(options.target),
          types: mapTypes(options.type),
          dryRun: options.dryRun,
          force: options.force,
          pretty: options.pretty,
          deleteStale: options.delete,
        };

        // Dry-run: show plan without confirmation or writing
        if (options.dryRun) {
          const result = await runPush(syncOpts);
          process.stdout.write(result.output + '\n');
          process.exit(0);
        }

        // No force: check first, show plan, prompt for confirmation
        if (!options.force) {
          const check = await runCheck({
            targets: syncOpts.targets,
            types: syncOpts.types,
            pretty: options.pretty,
          });

          process.stdout.write(check.output + '\n');

          if (!check.hasDrift) {
            process.exit(0);
          }

          const confirmed = await confirm('Proceed with push?');
          if (!confirmed) {
            process.stderr.write('Push cancelled.\n');
            process.exit(0);
          }

          // User confirmed after seeing the full check output (including deletes).
          // Confirmation = consent to execute everything shown.
          const hasDeletes = check.diffs.some((d) => d.summary.delete > 0);
          if (hasDeletes) syncOpts.deleteStale = true;
        }

        const result = await runPush({ ...syncOpts, force: true });
        process.stdout.write(result.output + '\n');
        process.exit(result.failed > 0 ? 1 : 0);
      } catch (err) {
        process.stderr.write(
          `Error: ${err instanceof Error ? err.message : String(err)}\n`,
        );
        process.exit(1);
      }
    },
  );
