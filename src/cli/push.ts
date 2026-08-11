#!/usr/bin/env bun
import { readFile, unlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Command } from 'commander';
import { loadManifest, saveManifest, updateManifestItem } from '../core/manifest';
import { createBackup, createDirectoryBackup, restoreAll, cleanupAll } from '../core/rollback';
import { formatDryRunResult, formatPushResult } from '../core/formatter';
import type { PushTargetResult } from '../core/formatter';
import { atomicWrite } from '../infra/atomic-write';
import { createExclusionFilter } from '../infra/exclusion';
import {
  ALL_TARGETS,
  PROJECT_ROOT,
  createAdapter,
  createTargetAdapter,
  hashContent,
  readCanonicalCommands,
  readCanonicalAgents,
  readCanonicalMCPServers,
  readCanonicalInstructions,
  readCanonicalSkills,
  readCanonicalSettings,
  readCanonicalPlugins,
  readCanonicalHooks,
} from './canonical';
import { runCheck } from './check';
import { confirm, mapTargets, mapTypes, collect, validateTargets, validateTypes } from './cli-helpers';
import type { SyncOptions } from './canonical';
import type { DiffResult } from '../types';
import type { BackupInfo } from '../core/rollback';
import { assertProjectionWritable, historicallyOwnedSharedSkillNames, planSkillProjection, projectionNeedsUpdate, replaceSkillTree } from '../core/skill-projection';

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
  if (targets.includes('opencode') && targets.includes('opencode2')) {
    throw new Error('OpenCode targets opencode and opencode2 share one installation; select only one');
  }
  const isExcluded = createExclusionFilter();

  const manifest = await loadManifest(projectDir);

  const [commands, agents, mcpServers, skills, plugins] = await Promise.all([
    readCanonicalCommands(projectDir, isExcluded),
    readCanonicalAgents(projectDir, isExcluded),
    readCanonicalMCPServers(projectDir),
    readCanonicalSkills(projectDir, isExcluded),
    readCanonicalPlugins(projectDir, isExcluded),
  ]);
  const homeDir = options.homeDir ?? createAdapter('codex').getPaths().expandHome('~');
  const historicalSharedSkills = (!options.types || options.types.includes('skill'))
    ? await historicallyOwnedSharedSkillNames(manifest, skills.map((skill) => skill.name), join(homeDir, '.agents', 'skills'))
    : new Set<string>();
  const skillPlan = (!options.types || options.types.includes('skill'))
    ? await planSkillProjection({
      projectDir,
      homeDir,
      targets,
      publicSkillNames: skills.map((skill) => skill.name),
      deleteStale: options.deleteStale ?? false,
      historicallyOwnedPublicSkillNames: historicalSharedSkills,
      historicalManifest: manifest,
    })
    : { operations: [], privateSkills: [] };

  let privateProjectionPreflightFailed = false;
  // Validate every projection destination before any file is written.
  for (const operation of skillPlan.operations) {
    if ((operation.kind === 'public' || operation.kind === 'private') && operation.sourceDir && operation.marker) {
      try {
        await assertProjectionWritable(operation.sourceDir, operation.filesystemPath, operation.marker, operation.historicalAdoption);
      } catch (error) {
        if (operation.kind === 'private') {
          privateProjectionPreflightFailed = true;
          continue;
        }
        throw error;
      }
    }
  }

  const checkResult = await runCheck({ ...options, projectDir, targets });

  const privateDrift = checkResult.privateSkillDrift !== undefined;

  if (privateProjectionPreflightFailed) {
    if (options.dryRun) {
      return {
        diffs: checkResult.diffs,
        hasDrift: true,
        written: 0,
        failed: 1,
        rolledBack: false,
        output: formatPushResult([{ target: targets[0] ?? 'claude-code', operations: [], success: false, error: 'Private skill projection failed (1)' }], options.pretty ?? !options.json),
      };
    }
    throw new Error('Private skill projection failed (1)');
  }

  if (!checkResult.hasDrift && !privateDrift) {
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
    const pretty = options.pretty ?? !options.json;
    const { output, hasDrift } = formatDryRunResult(checkResult.diffs, pretty, options.homeDir, checkResult.privateSkillDrift);
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
  let privateProjectionFailure = false;

  try {
  for (const diff of checkResult.diffs) {
    const target = diff.target;
    const adapter = await createTargetAdapter(target, options.homeDir);
    const caps = adapter.getCapabilities();
    const writeOps = diff.operations.filter((op) => (op.type === 'create' || op.type === 'update') && op.itemType !== 'skill');
    const deleteOps = diff.operations.filter((op) => op.type === 'delete' && op.itemType !== 'skill');

    if (writeOps.length === 0 && deleteOps.length === 0) {
      pushResults.push({ target, operations: diff.operations, success: true });
      continue;
    }

    const renderedContent = new Map<string, string>();
    const backupsByPath = new Map<string, BackupInfo>();

      for (const op of writeOps) {
        if (!op.targetPath) continue;

        let backup = backupsByPath.get(op.targetPath);
        if (!backup) {
          backup = await createBackup(op.targetPath);
          allBackups.push(backup);
          backupsByPath.set(op.targetPath, backup);
        }

        let existingContent = renderedContent.get(op.targetPath);
        if (existingContent === undefined && backup.existed) {
          try {
            existingContent = await readFile(backup.backupPath, 'utf-8');
          } catch {
            // Use no existing content
          }
        }

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
          content = adapter.renderMCPServers(mcpServers, existingContent);
        } else if (op.itemType === 'instruction') {
          const instructionContent = await readCanonicalInstructions(projectDir);
          if (!instructionContent) continue;
          content = adapter.renderInstructions(instructionContent);
        } else if (op.itemType === 'plugin') {
          if (!caps.plugins) continue;
          const item = plugins.find((p) => p.name === op.name);
          if (!item) continue;
          content = adapter.renderPlugin(item).content;
        } else if (op.itemType === 'settings') {
          if (!caps.settings) continue;
          const settings = await readCanonicalSettings(projectDir, target);
          if (!settings) continue;
          if (op.name.startsWith('profile:')) {
            const profile = adapter.renderAdditionalSettings(settings).find((file) => file.relativePath === op.targetPath);
            if (!profile) continue;
            content = profile.content;
          } else {
            content = adapter.renderSettings(settings, existingContent);
          }
        } else if (op.itemType === 'hook') {
          if (!caps.hooks) continue;
          const hooks = await readCanonicalHooks(projectDir, target);
          if (!hooks) continue;
          content = adapter.renderHooks(hooks, existingContent);
        } else {
          continue;
        }

        await atomicWrite(op.targetPath, content);
        renderedContent.set(op.targetPath, content);
        totalWritten++;

        const sourceHash = op.newHash ?? hashContent(op.targetPath);
        const targetHash = sourceHash;
        updateManifestItem(manifest, op.itemType, op.name, sourceHash, target, targetHash);
      }

      if (options.deleteStale) {
        for (const op of deleteOps) {
          if (!op.targetPath) continue;
          const backup = await createBackup(op.targetPath);
          allBackups.push(backup);
          await unlink(op.targetPath);
        }
      }

      pushResults.push({ target, operations: diff.operations, success: true });
  }

    for (const operation of skillPlan.operations) {
      if (operation.kind === 'public' || operation.kind === 'private') {
        if (!operation.sourceDir || !operation.marker) continue;
        const needsUpdate = operation.kind === 'private'
          ? await projectionNeedsUpdate(operation.sourceDir, operation.filesystemPath, operation.marker)
          : checkResult.diffs.find((diff) => diff.target === operation.target)?.operations.some(
            (diffOperation) => diffOperation.itemType === 'skill' && diffOperation.name === operation.name && (diffOperation.type === 'create' || diffOperation.type === 'update'),
          ) ?? false;
        if (!needsUpdate) continue;
        const backup = await createDirectoryBackup(operation.filesystemPath);
        allBackups.push(backup);
        const write = () => replaceSkillTree(operation.sourceDir!, operation.filesystemPath, operation.marker!, operation.historicalAdoption);
        try {
          if (options.projectionExecutor) await options.projectionExecutor(operation, write);
          else await write();
        } catch (error) {
          privateProjectionFailure = operation.kind === 'private';
          throw error;
        }
        if (operation.kind === 'public' && operation.target) {
          const item = skills.find((skill) => skill.name === operation.name);
          if (item) await atomicWrite(join(operation.filesystemPath, 'SKILL.md'), (await createTargetAdapter(operation.target, options.homeDir)).renderSkill(item).content);
        }
        totalWritten++;
        if (operation.kind === 'public' && operation.target) {
          const item = skills.find((skill) => skill.name === operation.name);
          if (item) updateManifestItem(manifest, 'skill', item.name, item.hash ?? hashContent(item.content), operation.target, item.hash ?? hashContent(item.content));
        }
      } else if (operation.kind === 'stale-delete' || operation.kind === 'legacy-delete' || operation.kind === 'private-delete') {
        if (operation.kind === 'private-delete' && !options.deleteStale) continue;
        const backup = await createDirectoryBackup(operation.filesystemPath);
        allBackups.push(backup);
        await rm(operation.filesystemPath, { recursive: true, force: true });
        totalWritten++;
      }
    }
    for (const privateSkill of skillPlan.privateSkills) {
      delete manifest.items[`skill/${privateSkill.name}`];
    }
    await saveManifest(manifest, projectDir);
    await cleanupAll(allBackups);
  } catch (err) {
    totalFailed++;
    const errorMsg = privateProjectionFailure ? 'Private skill projection failed (1)' : err instanceof Error ? err.message : String(err);
    const restore = await restoreAll(allBackups);
    await cleanupAll(allBackups);
    rolledBack = restore.restored > 0;
    const rollbackError = restore.failed > 0
      ? `${errorMsg}; rollback failed for ${restore.failed} item(s)`
      : errorMsg;
    pushResults.push({
      target: checkResult.diffs.at(-1)?.target ?? targets[0] ?? 'claude-code',
      operations: [],
      success: false,
      error: rollbackError,
    });
  }

  const prettyOut = options.pretty ?? !options.json;
  const output = formatPushResult(pushResults, prettyOut);
  return {
    diffs: checkResult.diffs,
    hasDrift: checkResult.hasDrift || privateDrift || totalFailed > 0,
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
  metronome push                           Check, confirm, then push all
  metronome push --force                   Push without confirmation
  metronome push --dry-run                 Show plan without writing anything
  metronome push --delete                  Push and remove stale target files
  metronome push -t claude --type commands Push commands to Claude Code only
  metronome push --force --delete          Full sync: push all + clean stale`)
  .option('--json', 'Machine-readable JSON output')
  .option('-t, --target <name>', 'Scope to specific target (repeatable): claude, antigravity, codex, opencode, opencode2', collect, [] as string[])
  .option('--type <name>', 'Scope to config type (repeatable): commands, agents, mcps, instructions, skills, settings, plugins, hooks', collect, [] as string[])
  .option('--dry-run', 'Show execution plan without writing')
  .option('--force', 'Skip confirmation prompt')
  .option('--delete', 'Delete stale target files not in canonical source (default: skip)')
  .action(
    async (options: {
      json?: boolean;
      target: string[];
      type: string[];
      dryRun?: boolean;
      force?: boolean;
      delete?: boolean;
    }) => {
      try {
        validateTargets(options.target);
        validateTypes(options.type);

        const pretty = !options.json;
        const syncOpts = {
          targets: mapTargets(options.target),
          types: mapTypes(options.type),
          dryRun: options.dryRun,
          force: options.force,
          pretty,
          deleteStale: options.delete,
        };

        // Dry-run: show plan without confirmation or writing
        if (options.dryRun) {
          const result = await runPush(syncOpts);
          process.stdout.write(result.output + '\n');
          process.exit(0);
        }

        // No force: check first, show plan, prompt for confirmation (skip prompt when not a TTY)
        if (!options.force && process.stdin.isTTY) {
          const check = await runCheck({
            targets: syncOpts.targets,
            types: syncOpts.types,
            pretty,
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
