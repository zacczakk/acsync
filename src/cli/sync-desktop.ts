#!/usr/bin/env bun
import os from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import pc from 'picocolors';
import { PROJECT_ROOT } from './canonical';
import { syncClaudeDesktop, type Variant } from '../desktop/claude-desktop-sync';

const VALID_VARIANTS: Variant[] = ['claude', 'claude-3p'];

export const syncDesktopCommand = new Command('sync-desktop')
  .description(
    `Sync canonical configs to Claude Desktop (regular + 3p / Cowork variants).

Writes two surfaces per detected variant:
  1. CLAUDE.md  — composed from configs/instructions/AGENTS.md + Memory vault
                  (IDENTITY/SOUL/USER) → memory/CLAUDE.md
  2. Skills     — copies configs/skills/* into the per-account skills-plugin
                  scaffold; preserves Anthropic-managed skills, upserts user
                  entries in manifest.json

MCP servers are NOT synced here — they live in ~/.claude.json (managed by the
claude-code adapter, shared by both Desktop variants via the bundled SDK).

Auto-discovers account/org UUIDs from local-agent-mode-sessions/. Idempotent:
re-runs produce identical bytes when sources are unchanged.

Examples:
  metronome sync-desktop                        Sync to all detected variants
  metronome sync-desktop --variant claude-3p    Sync only to Cowork (3p)
  metronome sync-desktop --memory-vault PATH    Override default ~/Vaults/Memory`,
  )
  .option(
    '--variant <name>',
    `Restrict to a single variant: ${VALID_VARIANTS.join(', ')}`,
  )
  .option(
    '--memory-vault <path>',
    'Path to Memory vault containing IDENTITY.md/SOUL.md/USER.md',
    join(os.homedir(), 'Vaults/Memory'),
  )
  .option('--dry-run', 'Show what would happen without writing', false)
  .action(async (opts: { variant?: string; memoryVault: string; dryRun: boolean }) => {
    try {
      if (opts.variant && !VALID_VARIANTS.includes(opts.variant as Variant)) {
        throw new Error(`Invalid variant "${opts.variant}". Valid: ${VALID_VARIANTS.join(', ')}`);
      }

      if (opts.dryRun) {
        process.stderr.write(pc.yellow('--dry-run not yet implemented; aborting before write\n'));
        process.exit(2);
      }

      const result = await syncClaudeDesktop({
        configsDir: join(PROJECT_ROOT, 'configs'),
        memoryVaultDir: opts.memoryVault,
        variants: opts.variant ? [opts.variant as Variant] : undefined,
      });

      if (result.variants.length === 0) {
        process.stderr.write(
          pc.yellow('No Claude Desktop variants found (or no account/org detected).\n'),
        );
        process.stderr.write(
          pc.dim(
            '  Looked under: ~/Library/Application Support/{Claude,Claude-3p}/local-agent-mode-sessions/\n',
          ),
        );
        process.exit(0);
      }

      for (const v of result.variants) {
        const d = result.details[v];
        if (!d) continue;
        process.stdout.write(pc.green(`✓ ${v}\n`));
        process.stdout.write(`  instructions: ${d.instructions ? 'written' : 'skipped'}\n`);
        process.stdout.write(`  skills:       ${d.skills} user skill(s) synced\n`);
      }
      process.stdout.write(
        pc.dim('\nMCP servers managed via ~/.claude.json (claude-code adapter). Restart Claude Desktop to pick up changes.\n'),
      );
      process.exit(0);
    } catch (err) {
      process.stderr.write(pc.red(`Error: ${err instanceof Error ? err.message : String(err)}\n`));
      process.exit(1);
    }
  });
