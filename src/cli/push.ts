#!/usr/bin/env bun
import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { runCheck } from './sync-check';
import { runPush } from './sync-push';
import { mapTargets, mapTypes, collect, validateTargets, validateTypes } from './cli-helpers';

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
    });
  });
}

export const pushCommand = new Command('push')
  .description('Render and write configs to target locations')
  .option('--pretty', 'Human-readable colored output (default: JSON)')
  .option('--json', 'Output JSON (default behavior, explicit for scripts)')
  .option('-t, --target <name>', 'Scope to specific target (repeatable): claude, gemini, codex, opencode', collect, [] as string[])
  .option('--type <name>', 'Scope to config type (repeatable): commands, agents, mcps, instructions, skills', collect, [] as string[])
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
        }

        const result = await runPush({ ...syncOpts, force: true, deleteStale: options.delete });
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
