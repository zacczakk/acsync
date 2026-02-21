#!/usr/bin/env bun
import { Command } from 'commander';
import { runCheck } from './sync-check';
import { mapTargets, mapTypes, collect, validateTargets, validateTypes } from './cli-helpers';

export const checkCommand = new Command('check')
  .description('Detect drift between canonical and target configs')
  .option('--pretty', 'Human-readable colored output (default: JSON)')
  .option('--json', 'Output JSON (default behavior, explicit for scripts)')
  .option('-t, --target <name>', 'Scope to specific target (repeatable): claude, gemini, codex, opencode', collect, [] as string[])
  .option('--type <name>', 'Scope to config type (repeatable): commands, agents, mcps, instructions, skills', collect, [] as string[])
  .action(async (options: { pretty?: boolean; json?: boolean; target: string[]; type: string[] }) => {
    try {
      validateTargets(options.target);
      validateTypes(options.type);

      const result = await runCheck({
        targets: mapTargets(options.target),
        types: mapTypes(options.type),
        pretty: options.pretty,
      });

      process.stdout.write(result.output + '\n');
      process.exit(result.hasDrift ? 2 : 0);
    } catch (err) {
      process.stderr.write(
        `Error: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(1);
    }
  });
