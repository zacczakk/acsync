#!/usr/bin/env bun
import { readdir, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { Command } from 'commander';
import pc from 'picocolors';
import { writeSupportFiles } from '../infra/support-files';
import { createBackup, restoreAll, cleanupAll } from '../core/rollback';
import { atomicWrite } from '../infra/atomic-write';
import { createExclusionFilter } from '../infra/exclusion';
import { stringifyFrontmatter } from '../formats/markdown';
import { ALL_TARGETS, COMMANDS_DIR, AGENTS_DIR, SKILLS_DIR, createAdapter } from './canonical';
import { confirm, validatePullSource } from './cli-helpers';
import type { TargetName } from '../types';
import type { BackupInfo } from '../core/rollback';

export interface PullOptions {
  source: TargetName;
  force?: boolean;
  dryRun?: boolean;
  pretty?: boolean;
  projectDir?: string;
  /** When set, only pull items whose "type/name" key is in this set */
  onlyKeys?: Set<string>;
}

export interface PullItem {
  type: 'command' | 'agent' | 'skill';
  name: string;
  action: 'create' | 'skip';
  targetPath: string;
  source?: TargetName; // set when pulling from multiple sources
}

export interface OrchestratorPullResult {
  items: PullItem[];
  pulled: number;
  skipped: number;
  dryRun: boolean;
  rolledBack: boolean;
  output: string;
}

export interface PullAllOptions {
  force?: boolean;
  dryRun?: boolean;
  pretty?: boolean;
  projectDir?: string;
}

/** Map internal target name to user-facing display name */
function displayTarget(target: TargetName): string {
  return target === 'claude-code' ? 'claude' : target;
}

/**
 * Pull commands/agents from a target CLI back into canonical format.
 * Reads from installed target configs, writes to configs/.
 */
export async function runPull(options: PullOptions): Promise<OrchestratorPullResult> {
  const projectDir = options.projectDir ?? cwd();
  const adapter = createAdapter(options.source);
  const isExcluded = createExclusionFilter(['gsd-*', '.acsync-backup-*']);
  const paths = adapter.getPaths();

  // Discover existing canonical names to detect conflicts
  const existingCommandNames = new Set<string>();
  const existingAgentNames = new Set<string>();
  const existingSkillNames = new Set<string>();

  if (!options.force) {
    const cmdDir = join(projectDir, COMMANDS_DIR);
    try {
      for (const entry of await readdir(cmdDir)) {
        if (entry.endsWith('.md')) existingCommandNames.add(entry.slice(0, -3));
      }
    } catch { /* dir doesn't exist yet */ }

    const agentDir = join(projectDir, AGENTS_DIR);
    try {
      for (const entry of await readdir(agentDir)) {
        if (entry.endsWith('.md')) existingAgentNames.add(entry.slice(0, -3));
      }
    } catch { /* dir doesn't exist yet */ }

    const skillDir = join(projectDir, SKILLS_DIR);
    try {
      for (const entry of await readdir(skillDir)) {
        if (entry.startsWith('.')) continue;
        try {
          await readFile(join(skillDir, entry, 'SKILL.md'), 'utf-8');
          existingSkillNames.add(entry);
        } catch { /* not a valid skill dir */ }
      }
    } catch { /* dir doesn't exist yet */ }
  }

  const items: PullItem[] = [];

  // Collect items to pull (discovery pass)
  const commandNames = await adapter.listExistingCommandNames();
  for (const name of commandNames) {
    if (isExcluded(name)) continue;
    if (options.onlyKeys && !options.onlyKeys.has(`command/${name}`)) continue;

    const targetPath = join(projectDir, COMMANDS_DIR, `${name}.md`);

    if (!options.force && existingCommandNames.has(name)) {
      items.push({ type: 'command', name, action: 'skip', targetPath });
      continue;
    }

    items.push({ type: 'command', name, action: 'create', targetPath });
  }

  const agentNames = await adapter.listExistingAgentNames();
  for (const name of agentNames) {
    if (isExcluded(name)) continue;
    if (options.onlyKeys && !options.onlyKeys.has(`agent/${name}`)) continue;

    const targetPath = join(projectDir, AGENTS_DIR, `${name}.md`);

    if (!options.force && existingAgentNames.has(name)) {
      items.push({ type: 'agent', name, action: 'skip', targetPath });
      continue;
    }

    items.push({ type: 'agent', name, action: 'create', targetPath });
  }

  const caps = adapter.getCapabilities();
  if (caps.skills) {
    const skillNames = await adapter.listExistingSkillNames();
    for (const name of skillNames) {
      if (isExcluded(name)) continue;
      if (options.onlyKeys && !options.onlyKeys.has(`skill/${name}`)) continue;

      const targetPath = join(projectDir, SKILLS_DIR, name, 'SKILL.md');

      if (!options.force && existingSkillNames.has(name)) {
        items.push({ type: 'skill', name, action: 'skip', targetPath });
        continue;
      }

      items.push({ type: 'skill', name, action: 'create', targetPath });
    }
  }

  const pulled = items.filter((i) => i.action === 'create').length;
  const skipped = items.filter((i) => i.action === 'skip').length;

  // Dry-run: skip writes
  if (options.dryRun) {
    const output = formatPullResult(items, options.source, options.pretty ?? false, true);
    return { items, pulled, skipped, dryRun: true, rolledBack: false, output };
  }

  // Write pass with rollback
  const allBackups: BackupInfo[] = [];
  let rolledBack = false;

  try {
    for (const item of items) {
      if (item.action !== 'create') continue;

      const backup = await createBackup(item.targetPath);
      allBackups.push(backup);

      if (item.type === 'command') {
        const filePath = paths.getCommandFilePath(item.name);
        const content = await readFile(filePath, 'utf-8');
        const canonical = adapter.parseCommand(item.name, content);
        const rendered = stringifyFrontmatter(canonical.content, canonical.metadata);
        await mkdir(join(projectDir, COMMANDS_DIR), { recursive: true });
        await atomicWrite(item.targetPath, rendered);
      } else if (item.type === 'agent') {
        const filePath = paths.getAgentFilePath(item.name);
        const content = await readFile(filePath, 'utf-8');
        const canonical = adapter.parseAgent(item.name, content);
        const rendered = stringifyFrontmatter(canonical.content, canonical.metadata);
        await mkdir(join(projectDir, AGENTS_DIR), { recursive: true });
        await atomicWrite(item.targetPath, rendered);
      } else if (item.type === 'skill') {
        const skill = await adapter.readSkill(item.name);
        const rendered = stringifyFrontmatter(skill.content, skill.metadata);
        const skillDir = join(projectDir, SKILLS_DIR, item.name);
        await mkdir(skillDir, { recursive: true });
        await atomicWrite(join(skillDir, 'SKILL.md'), rendered);
        if (skill.supportFiles && skill.supportFiles.length > 0) {
          await writeSupportFiles(skillDir, skill.supportFiles);
        }
      }
    }

    await cleanupAll(allBackups);
  } catch (err) {
    console.error(`Pull failed: ${err instanceof Error ? err.message : String(err)}`);
    console.error('Rolling back...');
    await restoreAll(allBackups);
    rolledBack = true;
  }

  const output = formatPullResult(items, options.source, options.pretty ?? false, false);
  return { items, pulled, skipped, dryRun: false, rolledBack, output };
}

/**
 * Pull from all targets, deduplicating by item key (type/name).
 * First source that has an item wins; later sources skip it.
 *
 * Discovery pass: dry-run all targets to collect available items.
 * Write pass: pull only first-source winners via single-target runPull calls
 * with a filtered item set, so no overwrites between targets.
 */
export async function runPullAll(options: PullAllOptions = {}): Promise<OrchestratorPullResult> {
  const projectDir = options.projectDir ?? cwd();

  const discoveries = new Map<TargetName, PullItem[]>();
  for (const target of ALL_TARGETS) {
    const result = await runPull({
      source: target,
      force: options.force,
      dryRun: true,
      projectDir,
    });
    discoveries.set(target, result.items);
  }

  const seen = new Set<string>();
  const allItems: PullItem[] = [];
  const winnersPerTarget = new Map<TargetName, Set<string>>();

  for (const target of ALL_TARGETS) {
    const items = discoveries.get(target) ?? [];
    for (const item of items) {
      const key = `${item.type}/${item.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      allItems.push({ ...item, source: target });

      if (item.action === 'create') {
        if (!winnersPerTarget.has(target)) winnersPerTarget.set(target, new Set());
        winnersPerTarget.get(target)!.add(key);
      }
    }
  }

  const totalPulled = allItems.filter((i) => i.action === 'create').length;
  const totalSkipped = allItems.filter((i) => i.action === 'skip').length;

  if (options.dryRun) {
    const output = formatPullAllResult(allItems, options.pretty ?? false, true);
    return { items: allItems, pulled: totalPulled, skipped: totalSkipped, dryRun: true, rolledBack: false, output };
  }

  for (const target of ALL_TARGETS) {
    const keys = winnersPerTarget.get(target);
    if (!keys || keys.size === 0) continue;
    await runPull({
      source: target,
      force: options.force,
      projectDir,
      onlyKeys: keys,
    });
  }

  const output = formatPullAllResult(allItems, options.pretty ?? false, false);
  return { items: allItems, pulled: totalPulled, skipped: totalSkipped, dryRun: false, rolledBack: false, output };
}

function formatPullAllResult(
  items: PullItem[],
  pretty: boolean,
  dryRun: boolean,
): string {
  if (!pretty) {
    const creates = items.filter((i) => i.action === 'create');
    const skips = items.filter((i) => i.action === 'skip');
    return JSON.stringify({
      source: 'all',
      dryRun,
      items: creates,
      summary: { pull: creates.length, skip: skips.length },
    }, null, 2);
  }

  const lines: string[] = ['', `acsync pull --source all${dryRun ? ' --dry-run' : ''}`, ''];

  const creates = items.filter((i) => i.action === 'create');

  const bySource = new Map<TargetName, PullItem[]>();
  for (const item of creates) {
    const src = item.source!;
    if (!bySource.has(src)) bySource.set(src, []);
    bySource.get(src)!.push(item);
  }

  for (const [target, targetItems] of bySource) {
    lines.push(`  ${pc.bold(displayTarget(target))}`);
    for (const item of targetItems) {
      const label = `[${item.type}]`.padEnd(14);
      const verb = dryRun ? 'would pull' : 'pulled';
      lines.push(`    ${pc.green('+')} ${label} ${item.name.padEnd(30)} ${pc.dim(`(${verb})`)}`);
    }
    lines.push('');
  }

  if (creates.length === 0) {
    lines.push(`  ${pc.dim('Nothing to pull.')}`);
    lines.push('');
  }

  const skips = items.filter((i) => i.action === 'skip');
  const parts: string[] = [];
  if (creates.length > 0) parts.push(pc.green(`${creates.length} to pull`));
  if (skips.length > 0) parts.push(pc.dim(`${skips.length} existing`));
  if (parts.length > 0) lines.push(`  Summary: ${parts.join(', ')}`);
  lines.push('');

  return lines.join('\n');
}

function formatPullResult(
  items: PullItem[],
  source: TargetName,
  pretty: boolean,
  dryRun: boolean,
): string {
  if (!pretty) {
    const creates = items.filter((i) => i.action === 'create');
    const skips = items.filter((i) => i.action === 'skip');
    return JSON.stringify({
      source: displayTarget(source),
      dryRun,
      items: creates,
      summary: { pull: creates.length, skip: skips.length },
    }, null, 2);
  }

  const lines: string[] = ['', `acsync pull --source ${displayTarget(source)}${dryRun ? ' --dry-run' : ''}`, ''];

  const creates = items.filter((i) => i.action === 'create');
  const skips = items.filter((i) => i.action === 'skip');

  for (const item of creates) {
    const label = `[${item.type}]`.padEnd(14);
    const verb = dryRun ? 'would pull' : 'pulled';
    lines.push(`  ${pc.green('+')} ${label} ${item.name.padEnd(30)} ${pc.dim(`(${verb})`)}`);
  }

  if (creates.length === 0) {
    lines.push(`  ${pc.dim('Nothing to pull.')}`);
  }

  lines.push('');
  const parts: string[] = [];
  if (creates.length > 0) parts.push(pc.green(`${creates.length} to pull`));
  if (skips.length > 0) parts.push(pc.dim(`${skips.length} existing`));
  if (parts.length > 0) lines.push(`  Summary: ${parts.join(', ')}`);
  lines.push('');

  return lines.join('\n');
}

export const pullCommand = new Command('pull')
  .description(
    `Pull configs from a target CLI back to canonical format in configs/.

Reverse of push: reads installed target configs, reverse-parses them through the
adapter, and writes canonical markdown with frontmatter to configs/.
Skips items that already exist in canonical unless --force is used.

Use --source all to deduplicate across all 4 targets (first-source-wins).

Examples:
  acsync pull -s claude                 Pull from Claude Code
  acsync pull -s all                    Pull from all targets, deduplicate
  acsync pull -s opencode --force       Pull from OpenCode, overwrite existing
  acsync pull -s claude --dry-run       Preview what would be pulled`)
  .requiredOption('-s, --source <target>', 'Source target: all, claude, gemini, codex, opencode')
  .option('--pretty', 'Human-readable colored output (default: JSON)')
  .option('--force', 'Overwrite existing canonical items')
  .option('--dry-run', 'Show what would be pulled without writing')
  .action(
    async (options: {
      source: string;
      pretty?: boolean;
      force?: boolean;
      dryRun?: boolean;
    }) => {
      try {
        validatePullSource(options.source);

        const isAll = options.source === 'all';
        const baseOpts = { force: options.force, pretty: options.pretty };

        const doPull = (dryRun?: boolean) => {
          if (isAll) {
            return runPullAll({ ...baseOpts, dryRun });
          }
          const source: TargetName = options.source === 'claude' ? 'claude-code' : options.source as TargetName;
          return runPull({ ...baseOpts, source, dryRun });
        };

        // Dry-run: show plan without writing
        if (options.dryRun) {
          const result = await doPull(true);
          process.stdout.write(result.output + '\n');
          process.exit(0);
        }

        // No force: preview first, then confirm
        if (!options.force) {
          const preview = await doPull(true);
          process.stdout.write(preview.output + '\n');

          if (preview.pulled === 0) {
            process.exit(0);
          }

          const confirmed = await confirm(`Pull ${preview.pulled} item(s)?`);
          if (!confirmed) {
            process.stderr.write('Pull cancelled.\n');
            process.exit(0);
          }
        }

        // Execute pull
        const result = await doPull();
        process.stdout.write(result.output + '\n');
        process.exit(0);
      } catch (err) {
        process.stderr.write(
          `Error: ${err instanceof Error ? err.message : String(err)}\n`,
        );
        process.exit(1);
      }
    },
  );
