import { homedir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { PROJECT_ROOT } from './canonical';
import { getOpenCodeVersionStatus, switchOpenCodeVersion } from '../opencode/profile';
import { alignOpenCodePluginSdk, restartAndVerifyOpenCodeV2, runCommand, updateOpenCodeV2Safely, verifyOpenCodeV2Plugins, type PluginVerificationProgress } from '../opencode/sdk';
import type { OpenCodeVersion } from '../opencode/version-renderer';

function version(value: string): OpenCodeVersion {
  if (value !== 'v1' && value !== 'v2') throw new Error('Version must be v1 or v2');
  return value;
}

function formatDuration(milliseconds: number): string {
  return milliseconds < 1_000 ? `${milliseconds}ms` : `${(milliseconds / 1_000).toFixed(1)}s`;
}

export function formatVerificationProgress(progress: PluginVerificationProgress): string {
  const details = [
    progress.failure,
    progress.missing.length > 0 ? `required missing: ${progress.missing.join(', ')}` : undefined,
    progress.optionalMissing.length > 0 ? `optional unavailable: ${progress.optionalMissing.join(', ')}` : undefined,
  ].filter((value): value is string => value !== undefined).join('; ');
  const suffix = details ? `; ${details}` : '';
  if (progress.status === 'ready') {
    return `Plugin catalog ready (${progress.attempt}/${progress.attempts}; ${formatDuration(progress.attemptMs)}${suffix})`;
  }
  return `Plugin catalog waiting (${progress.attempt}/${progress.attempts}; ${formatDuration(progress.attemptMs)}${suffix})`;
}

export function verificationReporter(report: (message: string) => void): (progress: PluginVerificationProgress) => void {
  let lastState = '';
  return (progress) => {
    const state = [progress.status, progress.failure, progress.missing.join(','), progress.optionalMissing.join(',')].join('|');
    const periodic = progress.attempt === 1 || progress.attempt % 10 === 0 || progress.attempt === progress.attempts;
    if (state !== lastState || periodic || progress.status === 'ready') report(formatVerificationProgress(progress));
    lastState = state;
  };
}

function progressReporter(): (message: string) => void {
  return (message) => process.stderr.write(`  ${message}\n`);
}

export const opencodeVersionCommand = new Command('opencode')
  .description('Switch and maintain OpenCode V1/V2 compatibility profiles');

opencodeVersionCommand.command('use')
  .argument('<version>', 'v1 or v2')
  .option('--dry-run', 'Show paths without writing')
  .option('--no-align-sdk', 'Do not align the local V2 plugin SDK')
  .description('Atomically activate a rendered OpenCode compatibility profile')
  .action(async (rawVersion: string, options: { dryRun?: boolean; alignSdk?: boolean }) => {
    try {
      const selected = version(rawVersion);
      const homeDir = homedir();
      const report = options.dryRun ? undefined : progressReporter();
      if (report) {
        const mode = selected === 'v2' ? ' (hot reload; no service restart)' : '';
        process.stderr.write(`OpenCode ${selected.toUpperCase()} profile switch${mode}\n`);
      }
      const result = await switchOpenCodeVersion({
        version: selected,
        projectDir: PROJECT_ROOT,
        homeDir,
        dryRun: options.dryRun,
        progress: report,
        prepare: selected === 'v2' && options.alignSdk !== false && !options.dryRun
          ? async () => { report?.(`Resolved @opencode-ai/plugin to ${await alignOpenCodePluginSdk(join(homeDir, '.config', 'opencode'))}`); }
          : undefined,
        rollback: selected === 'v2' && options.alignSdk !== false && !options.dryRun
          ? () => runCommand('bun', ['install', '--frozen-lockfile'], join(homeDir, '.config', 'opencode')).then(() => undefined)
          : undefined,
        verifyPlugins: selected === 'v2' && !options.dryRun
          ? () => verifyOpenCodeV2Plugins(undefined, undefined, undefined, report ? verificationReporter(report) : undefined)
          : undefined,
      });
      process.stdout.write(`${options.dryRun ? 'Would activate' : 'Activated'} OpenCode ${selected.toUpperCase()}\n`);
      if (!options.dryRun) process.stdout.write(`Files written: ${result.written.length}\n`);
      process.stdout.write(`Backup: ${result.backupPath}\nManifest: ${result.manifestPath}\n`);
    } catch (error) {
      process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  });

opencodeVersionCommand.command('status')
  .description('Show the active Metronome OpenCode profile and latest switch')
  .action(async () => {
    const status = await getOpenCodeVersionStatus(homedir());
    if (!status) {
      process.stdout.write('OpenCode profile: unmanaged\n');
      return;
    }
    const latest = status.history.at(-1);
    process.stdout.write(`OpenCode profile: ${status.active.toUpperCase()}\n`);
    if (latest) process.stdout.write(`Last switch: ${latest.timestamp}\nBackup: ${latest.backup}\n`);
  });

opencodeVersionCommand.command('update-v2')
  .description('Update the Bun-installed V2 CLI, align the local SDK, restart, and verify plugins')
  .action(async () => {
    try {
      const homeDir = homedir();
      const configDir = join(homeDir, '.config', 'opencode');
      const report = progressReporter();
      process.stderr.write('OpenCode V2 update\n');
      const resolved = await updateOpenCodeV2Safely(configDir, async () => {
        await switchOpenCodeVersion({
          version: 'v2',
          projectDir: PROJECT_ROOT,
          homeDir,
          prepare: async () => { report(`Resolved @opencode-ai/plugin to ${await alignOpenCodePluginSdk(configDir)}`); },
          rollback: () => runCommand('bun', ['install', '--frozen-lockfile'], configDir).then(() => undefined),
          progress: report,
          verifyPlugins: () => restartAndVerifyOpenCodeV2(undefined, undefined, undefined, verificationReporter(report), report),
        });
      }, undefined, report);
      report(`Global CLI and local SDK resolved to ${resolved}`);
      process.stdout.write(`OpenCode V2 and @opencode-ai/plugin aligned at ${resolved}\n`);
    } catch (error) {
      process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  });
