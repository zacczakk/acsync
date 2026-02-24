#!/usr/bin/env bun
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { Command } from 'commander';
import {
  ALL_TARGETS,
  createAdapter,
  readCanonicalCommands,
  readCanonicalAgents,
  readCanonicalMCPServers,
  readCanonicalInstructions,
  readCanonicalSkills,
} from './canonical';
import { createExclusionFilter } from '../infra/exclusion';
import { parseFrontmatter } from '../formats/markdown';
import type { TargetName, CanonicalItem } from '../types';

const VALID_SINGULAR_TYPES = ['command', 'agent', 'mcp', 'instruction', 'skill'] as const;
type SingularType = (typeof VALID_SINGULAR_TYPES)[number];

const VALID_TARGETS = ['claude', 'gemini', 'codex', 'opencode'] as const;

function mapTarget(t: string): TargetName {
  if (t === 'claude') return 'claude-code';
  return t as TargetName;
}

export const renderCommand = new Command('render')
  .description('Render canonical config to target format and print to stdout')
  .requiredOption('--type <type>', `Config type: ${VALID_SINGULAR_TYPES.join(', ')}`)
  .requiredOption('--name <name>', 'Canonical item name (e.g., obs-triage-inbox, tavily)')
  .option('-t, --target <name>', `Target CLI: ${VALID_TARGETS.join(', ')}`)
  .action(async (options: { type: string; name: string; target?: string }) => {
    try {
      // Validate type
      if (!VALID_SINGULAR_TYPES.includes(options.type as SingularType)) {
        throw new Error(
          `Invalid type: "${options.type}". Valid types: ${VALID_SINGULAR_TYPES.join(', ')}`,
        );
      }

      // Validate target if provided
      if (options.target && !VALID_TARGETS.includes(options.target as typeof VALID_TARGETS[number])) {
        throw new Error(
          `Invalid target: "${options.target}". Valid targets: ${VALID_TARGETS.join(', ')}`,
        );
      }

      const targets = options.target
        ? [mapTarget(options.target)]
        : ALL_TARGETS;

      const projectDir = cwd();
      const itemType = options.type as SingularType;
      const name = options.name;

      for (const target of targets) {
        const adapter = createAdapter(target);
        const displayName = target === 'claude-code' ? 'claude' : target;
        let content: string;

        if (itemType === 'command') {
          const item = await readSingleCanonicalItem(projectDir, 'commands', name);
          content = adapter.renderCommand(item).content;
        } else if (itemType === 'agent') {
          const item = await readSingleCanonicalItem(projectDir, 'agents', name);
          content = adapter.renderAgent(item).content;
        } else if (itemType === 'mcp') {
          const servers = await readCanonicalMCPServers(projectDir);
          const server = servers.find((s) => s.name === name);
          if (!server) {
            throw new Error(`Canonical mcp "${name}" not found in configs/mcp/`);
          }
          content = adapter.renderMCPServers([server]);
        } else if (itemType === 'instruction') {
          const instructions = await readCanonicalInstructions(projectDir, target);
          if (!instructions) {
            throw new Error(`Canonical instruction not found (missing AGENTS.md)`);
          }
          content = adapter.renderInstructions(instructions.base, instructions.addendum);
        } else {
          // skill
          const isExcluded = createExclusionFilter(['gsd-*', '.acsync-backup-*']);
          const skills = await readCanonicalSkills(projectDir, isExcluded);
          const item = skills.find((s) => s.name === name);
          if (!item) {
            throw new Error(
              `Canonical skill "${name}" not found in configs/skills/${name}/SKILL.md`,
            );
          }
          content = adapter.renderSkill(item).content;
        }

        if (targets.length > 1) {
          process.stdout.write(`--- ${displayName} ---\n`);
        }
        process.stdout.write(content);
        if (!content.endsWith('\n')) {
          process.stdout.write('\n');
        }
      }

      process.exit(0);
    } catch (err) {
      process.stderr.write(
        `Error: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(1);
    }
  });

/**
 * Read a single canonical command or agent by name.
 * Reads directly from the known path rather than scanning the whole directory.
 */
async function readSingleCanonicalItem(
  projectDir: string,
  dirName: 'commands' | 'agents',
  name: string,
): Promise<CanonicalItem> {
  const filePath = join(projectDir, 'configs', dirName, `${name}.md`);
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch {
    throw new Error(
      `Canonical ${dirName.slice(0, -1)} "${name}" not found at ${filePath}`,
    );
  }
  const { data, content } = parseFrontmatter(raw);
  return { name, content, metadata: data };
}
