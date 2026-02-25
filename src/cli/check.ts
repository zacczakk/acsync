#!/usr/bin/env bun
import { join } from 'node:path';
import { Command } from 'commander';
import { loadManifest } from '../core/manifest';
import { calculateDiff } from '../core/diff';
import { formatCheckResult } from '../core/formatter';
import { createExclusionFilter, classifyEntry } from '../infra/exclusion';
import {
  ALL_TARGETS,
  COMMANDS_DIR,
  AGENTS_DIR,
  PROJECT_ROOT,
  createAdapter,
  hashRendered,
  hashTargetFile,
  hashContent,
  readCanonicalCommands,
  readCanonicalAgents,
  readCanonicalMCPServers,
  readCanonicalInstructions,
  readCanonicalSkills,
  readCanonicalSettings,
} from './canonical';
import { mapTargets, mapTypes, collect, validateTargets, validateTypes } from './cli-helpers';
import type { SyncOptions } from './canonical';
import type { ToolAdapter } from '../adapters/base';
import type { ItemType, MCPWarning, Operation, DiffResult } from '../types';
import type { SourceItem } from '../core/diff';

export interface OrchestratorCheckResult {
  diffs: DiffResult[];
  hasDrift: boolean;
  output: string;
}

/**
 * Detect stale items in a target directory that aren't in the canonical source.
 * Returns delete operations for non-canonical, non-excluded items.
 *
 * Items matching the exclusion filter (e.g. gsd-*) are never flagged as stale.
 * Everything else not in canonical is stale — the exclusion filter is the
 * safety mechanism, not empty-canonical heuristics.
 */
async function detectStaleItems(
  adapter: ToolAdapter,
  canonicalCommandNames: Set<string>,
  canonicalAgentNames: Set<string>,
  canonicalSkillNames: Set<string>,
  isExcluded: (name: string) => boolean,
  types?: ItemType[],
): Promise<Operation[]> {
  const deleteOps: Operation[] = [];
  const caps = adapter.getCapabilities();
  const paths = adapter.getPaths();
  const target = adapter.target;

  if (!types || types.includes('command')) {
    const existingCommands = await adapter.listExistingCommandNames();
    for (const name of existingCommands) {
      const entry = classifyEntry(name, canonicalCommandNames, isExcluded);
      if (entry.status === 'non-canonical') {
        deleteOps.push({
          type: 'delete',
          itemType: 'command',
          name,
          target,
          reason: 'Item not in canonical source (stale)',
          targetPath: paths.getCommandFilePath(name),
        });
      }
    }
  }

  if (!types || types.includes('agent')) {
    const existingAgents = await adapter.listExistingAgentNames();
    for (const name of existingAgents) {
      const entry = classifyEntry(name, canonicalAgentNames, isExcluded);
      if (entry.status === 'non-canonical') {
        deleteOps.push({
          type: 'delete',
          itemType: 'agent',
          name,
          target,
          reason: 'Item not in canonical source (stale)',
          targetPath: paths.getAgentFilePath(name),
        });
      }
    }
  }

  if ((!types || types.includes('skill')) && caps.skills) {
    const existingSkills = await adapter.listExistingSkillNames();
    for (const name of existingSkills) {
      const entry = classifyEntry(name, canonicalSkillNames, isExcluded);
      if (entry.status === 'non-canonical') {
        deleteOps.push({
          type: 'delete',
          itemType: 'skill',
          name,
          target,
          reason: 'Item not in canonical source (stale)',
          targetPath: join(paths.getSkillsDir(), name),
        });
      }
    }
  }

  return deleteOps;
}

/**
 * Run the check operation: render all canonical items, diff against targets.
 */
export async function runCheck(options: SyncOptions = {}): Promise<OrchestratorCheckResult> {
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

  const diffs: DiffResult[] = [];

  for (const target of targets) {
    const adapter = createAdapter(target, options.homeDir);
    const caps = adapter.getCapabilities();
    const sourceItems: SourceItem[] = [];
    const targetHashes = new Map<string, string>();

    // Commands
    if (!options.types || options.types.includes('command')) {
      if (caps.commands) {
        for (const item of commands) {
          const rendered = adapter.renderCommand(item);
          const sourceHash = hashRendered(rendered.content);
          const targetHash = await hashTargetFile(rendered.relativePath);
          sourceItems.push({
            type: 'command',
            name: item.name,
            hash: sourceHash,
            sourcePath: join(projectDir, COMMANDS_DIR, `${item.name}.md`),
            targetPath: rendered.relativePath,
          });
          if (targetHash !== null) {
            targetHashes.set(`command/${item.name}`, targetHash);
          }
        }
      }
    }

    // Agents
    if (!options.types || options.types.includes('agent')) {
      if (caps.agents) {
        for (const item of agents) {
          const rendered = adapter.renderAgent(item);
          const sourceHash = hashRendered(rendered.content);
          const targetHash = await hashTargetFile(rendered.relativePath);
          sourceItems.push({
            type: 'agent',
            name: item.name,
            hash: sourceHash,
            sourcePath: join(projectDir, AGENTS_DIR, `${item.name}.md`),
            targetPath: rendered.relativePath,
          });
          if (targetHash !== null) {
            targetHashes.set(`agent/${item.name}`, targetHash);
          }
        }
      }
    }

    // MCP
    let mcpWarning: MCPWarning | undefined;
    if (!options.types || options.types.includes('mcp')) {
      if (caps.mcp && mcpServers.length > 0) {
        const mcpPath = adapter.getPaths().getMCPConfigPath();
        const renderedNames = new Set(adapter.getRenderedServerNames(mcpServers));
        let existingContent: string | undefined;
        try {
          const file = Bun.file(mcpPath);
          if (await file.exists()) {
            existingContent = await file.text();
          }
        } catch {
          // Ignore
        }

        if (existingContent) {
          const existingNames = adapter.parseExistingMCPServerNames(existingContent);
          const nonCanonical = existingNames.filter((n) => !renderedNames.has(n));
          if (nonCanonical.length > 0) {
            mcpWarning = {
              serverNames: nonCanonical,
              action: adapter.removesNonCanonicalOnPush() ? 'remove' : 'orphan',
            };
          }
        }

        const rendered = adapter.renderMCPServers(mcpServers, existingContent);
        const sourceHash = hashRendered(rendered);
        const targetHash = await hashTargetFile(mcpPath);

        for (const server of mcpServers) {
          if (!renderedNames.has(server.name)) continue;
          sourceItems.push({
            type: 'mcp',
            name: server.name,
            hash: sourceHash,
            targetPath: mcpPath,
          });
          if (targetHash !== null) {
            targetHashes.set(`mcp/${server.name}`, targetHash);
          }
        }
      }
    }

    // Instructions
    if (!options.types || options.types.includes('instruction')) {
      if (caps.instructions) {
        const content = await readCanonicalInstructions(projectDir);
        if (content) {
          const rendered = adapter.renderInstructions(content);
          const sourceHash = hashRendered(rendered);
          const instructionsPath = adapter.getPaths().getInstructionsPath();
          const targetHash = await hashTargetFile(instructionsPath);

          sourceItems.push({
            type: 'instruction',
            name: 'instructions',
            hash: sourceHash,
            targetPath: instructionsPath,
          });
          if (targetHash !== null) {
            targetHashes.set('instruction/instructions', targetHash);
          }
        }
      }
    }

    // Skills
    if (!options.types || options.types.includes('skill')) {
      if (caps.skills) {
        for (const item of skills) {
          const rendered = adapter.renderSkill(item);
          const sourceHash = hashRendered(rendered.content);
          const targetHash = await hashTargetFile(rendered.relativePath);
          sourceItems.push({
            type: 'skill',
            name: item.name,
            hash: sourceHash,
            targetPath: rendered.relativePath,
          });
          if (targetHash !== null) {
            targetHashes.set(`skill/${item.name}`, targetHash);
          }
        }
      }
    }

    // Settings
    if (!options.types || options.types.includes('settings')) {
      if (caps.settings) {
        const settings = await readCanonicalSettings(projectDir, target);
        if (settings) {
          const canonicalKeys = Object.keys(settings.keys);
          // Source hash: stable JSON of canonical keys (sorted)
          const extracted: Record<string, unknown> = {};
          for (const key of [...canonicalKeys].sort()) {
            extracted[key] = settings.keys[key];
          }
          const sourceHash = hashContent(JSON.stringify(extracted, null, 2) + '\n');

          // Target hash: extract only canonical keys from installed file
          const settingsPath = adapter.getPaths().getSettingsPath();
          let targetHash: string | null = null;
          try {
            const file = Bun.file(settingsPath);
            if (await file.exists()) {
              const targetContent = await file.text();
              const targetExtracted = adapter.extractSettingsKeys(canonicalKeys, targetContent);
              targetHash = hashContent(targetExtracted);
            }
          } catch {
            // File missing or unreadable
          }

          sourceItems.push({
            type: 'settings',
            name: 'settings',
            hash: sourceHash,
            targetPath: settingsPath,
          });
          if (targetHash !== null) {
            targetHashes.set('settings/settings', targetHash);
          }
        }
      }
    }

    const diff = calculateDiff(sourceItems, targetHashes, manifest, target);
    if (mcpWarning) diff.mcpWarning = mcpWarning;

    const canonicalCommandNames = new Set(commands.map((c) => c.name));
    const canonicalAgentNames = new Set(agents.map((a) => a.name));
    const canonicalSkillNames = new Set(skills.map((s) => s.name));
    const staleOps = await detectStaleItems(adapter, canonicalCommandNames, canonicalAgentNames, canonicalSkillNames, isExcluded, options.types);
    if (staleOps.length > 0) {
      diff.operations.push(...staleOps);
      diff.summary.delete = staleOps.length;
    }

    diffs.push(diff);
  }

  const pretty = options.pretty ?? !options.json;
  const { output, hasDrift } = formatCheckResult(diffs, pretty);
  return { diffs, hasDrift, output };
}

export const checkCommand = new Command('check')
  .alias('status')
  .description(
    `Detect drift between canonical configs and installed target files.

Compares rendered canonical output against on-disk target files using SHA-256 hashes.
Reports create/update/skip/delete operations per target.

Examples:
  acsync check                          Human-readable colored output (default)
  acsync status                         Alias for check
  acsync check --json                   Machine-readable JSON output
  acsync check -t claude                Check Claude Code only
  acsync check --type commands          Check commands only across all targets
  acsync check -t codex --type mcps     Check Codex MCP servers only

Exit codes: 0 = no drift, 2 = drift detected, 1 = error`)
  .option('--json', 'Machine-readable JSON output')
  .option('-t, --target <name>', 'Scope to specific target (repeatable): claude, gemini, codex, opencode', collect, [] as string[])
  .option('--type <name>', 'Scope to config type (repeatable): commands, agents, mcps, instructions, skills, settings', collect, [] as string[])
  .action(async (options: { json?: boolean; target: string[]; type: string[] }) => {
    try {
      validateTargets(options.target);
      validateTypes(options.type);

      const result = await runCheck({
        targets: mapTargets(options.target),
        types: mapTypes(options.type),
        json: options.json,
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
