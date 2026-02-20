import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { cwd } from 'node:process';
import { createHash } from 'node:crypto';
import { loadManifest, saveManifest, updateManifestItem } from '../core/manifest';
import { calculateDiff } from '../core/diff';
import { createBackup, restoreAll, cleanupAll } from '../core/rollback';
import { formatCheckResult, formatDryRunResult, formatPushResult } from '../core/formatter';
import type { PushTargetResult } from '../core/formatter';
import { atomicWrite } from '../infra/atomic-write';
import { createExclusionFilter } from '../infra/exclusion';
import { loadSecrets } from '../secrets/env-loader';
import { injectSecrets } from '../secrets/injector';
import { parseFrontmatter } from '../formats/markdown';
import { ClaudeCodeAdapter } from '../adapters/claude-code';
import { OpenCodeAdapter } from '../adapters/opencode';
import { GeminiAdapter } from '../adapters/gemini';
import { CodexAdapter } from '../adapters/codex';
import type { ToolAdapter } from '../adapters/base';
import type { TargetName, ItemType, CanonicalItem, MCPServer } from '../types';
import type { SourceItem } from '../core/diff';
import type { BackupInfo } from '../core/rollback';

export interface SyncOptions {
  targets?: TargetName[];       // --target flag (all if empty)
  types?: ItemType[];           // --type flag (all if empty)
  dryRun?: boolean;             // --dry-run
  force?: boolean;              // --force (skip confirmation)
  pretty?: boolean;             // --pretty (human output)
  projectDir?: string;          // project root (default cwd)
}

export interface OrchestratorCheckResult {
  diffs: import('../types').DiffResult[];
  hasDrift: boolean;
  output: string;
}

export interface OrchestratorPushResult {
  diffs: import('../types').DiffResult[];
  hasDrift: boolean;
  written: number;
  failed: number;
  rolledBack: boolean;
  output: string;
}

const ALL_TARGETS: TargetName[] = ['claude-code', 'opencode', 'gemini', 'codex'];

function createAdapter(target: TargetName): ToolAdapter {
  switch (target) {
    case 'claude-code': return new ClaudeCodeAdapter();
    case 'opencode':    return new OpenCodeAdapter();
    case 'gemini':      return new GeminiAdapter();
    case 'codex':       return new CodexAdapter();
  }
}

function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Read canonical commands from configs/common/commands/*.md
 * Returns CanonicalItem[] with name from filename (without .md)
 */
async function readCanonicalCommands(
  projectDir: string,
  isExcluded: (name: string) => boolean,
): Promise<CanonicalItem[]> {
  const dir = join(projectDir, 'configs', 'common', 'commands');
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const items: CanonicalItem[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const name = entry.slice(0, -3); // strip .md
    if (isExcluded(name)) continue;

    const raw = await readFile(join(dir, entry), 'utf-8');
    const { data, content } = parseFrontmatter(raw);
    items.push({ name, content, metadata: data });
  }
  return items;
}

/**
 * Read canonical agents from configs/common/agents/*.md
 */
async function readCanonicalAgents(
  projectDir: string,
  isExcluded: (name: string) => boolean,
): Promise<CanonicalItem[]> {
  const dir = join(projectDir, 'configs', 'common', 'agents');
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const items: CanonicalItem[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const name = entry.slice(0, -3);
    if (isExcluded(name)) continue;

    const raw = await readFile(join(dir, entry), 'utf-8');
    const { data, content } = parseFrontmatter(raw);
    items.push({ name, content, metadata: data });
  }
  return items;
}

/**
 * Read canonical MCP servers from configs/common/mcp/*.json
 */
async function readCanonicalMCPServers(projectDir: string): Promise<MCPServer[]> {
  const dir = join(projectDir, 'configs', 'common', 'mcp');
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const servers: MCPServer[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const raw = await readFile(join(dir, entry), 'utf-8');
    try {
      const server = JSON.parse(raw) as MCPServer;
      // Use filename (without .json) as name if not specified
      if (!server.name) {
        server.name = entry.slice(0, -5);
      }
      servers.push(server);
    } catch {
      // Skip invalid JSON files
    }
  }
  return servers;
}

/**
 * Read canonical instructions: base AGENTS.md + CLI-specific addendum
 */
async function readCanonicalInstructions(
  projectDir: string,
  target: TargetName,
): Promise<{ base: string; addendum: string } | null> {
  const basePath = join(projectDir, 'AGENTS.md');
  let base: string;
  try {
    base = await readFile(basePath, 'utf-8');
  } catch {
    return null;
  }

  const addendumName = target === 'claude-code' ? 'claude' : target;
  const addendumPath = join(projectDir, 'configs', 'common', 'instructions', `${addendumName}.md`);
  let addendum = '';
  try {
    addendum = await readFile(addendumPath, 'utf-8');
  } catch {
    // No addendum for this target is fine
  }

  return { base, addendum };
}

/**
 * Read canonical skills from configs/common/skills/ directories
 * Each skill is a directory with a SKILL.md file
 */
async function readCanonicalSkills(
  projectDir: string,
  isExcluded: (name: string) => boolean,
): Promise<CanonicalItem[]> {
  const dir = join(projectDir, 'configs', 'common', 'skills');
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const items: CanonicalItem[] = [];
  for (const entry of entries) {
    if (isExcluded(entry)) continue;
    const skillMdPath = join(dir, entry, 'SKILL.md');
    try {
      const raw = await readFile(skillMdPath, 'utf-8');
      const { data, content } = parseFrontmatter(raw);
      items.push({ name: entry, content, metadata: data });
    } catch {
      // Skip directories without SKILL.md
    }
  }
  return items;
}

/** Hash a rendered file content to use as source hash */
function hashRendered(content: string): string {
  return hashContent(content);
}

/** Try to hash an existing target file; return null if not found */
async function hashTargetFile(filePath: string): Promise<string | null> {
  try {
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (!exists) return null;
    const content = await file.text();
    return hashContent(content);
  } catch {
    return null;
  }
}

/**
 * Run the check operation: render all canonical items, diff against targets.
 */
export async function runCheck(options: SyncOptions = {}): Promise<OrchestratorCheckResult> {
  const projectDir = options.projectDir ?? cwd();
  const targets = options.targets && options.targets.length > 0 ? options.targets : ALL_TARGETS;
  const isExcluded = createExclusionFilter(['gsd-*', '.acsync-backup-*']);

  const manifest = await loadManifest(projectDir);

  // Discover canonical configs
  const [commands, agents, mcpServers, skills] = await Promise.all([
    readCanonicalCommands(projectDir, isExcluded),
    readCanonicalAgents(projectDir, isExcluded),
    readCanonicalMCPServers(projectDir),
    readCanonicalSkills(projectDir, isExcluded),
  ]);

  const diffs: import('../types').DiffResult[] = [];

  for (const target of targets) {
    const adapter = createAdapter(target);
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
            sourcePath: join(projectDir, 'configs', 'common', 'commands', `${item.name}.md`),
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
            sourcePath: join(projectDir, 'configs', 'common', 'agents', `${item.name}.md`),
            targetPath: rendered.relativePath,
          });
          if (targetHash !== null) {
            targetHashes.set(`agent/${item.name}`, targetHash);
          }
        }
      }
    }

    // MCP — one source item per server (share aggregate hash + target path)
    if (!options.types || options.types.includes('mcp')) {
      if (caps.mcp && mcpServers.length > 0) {
        const mcpPath = adapter.getPaths().getMCPConfigPath();
        // Use adapter's own filter to determine which servers appear in diff
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

    // Instructions — one source item per contributing file
    if (!options.types || options.types.includes('instruction')) {
      if (caps.instructions) {
        const instructions = await readCanonicalInstructions(projectDir, target);
        if (instructions) {
          const rendered = adapter.renderInstructions(instructions.base, instructions.addendum);
          const sourceHash = hashRendered(rendered);
          const instructionsPath = adapter.getPaths().getInstructionsPath();
          const targetHash = await hashTargetFile(instructionsPath);

          // Base file (AGENTS.md)
          sourceItems.push({
            type: 'instruction',
            name: 'AGENTS.md',
            hash: sourceHash,
            targetPath: instructionsPath,
          });
          if (targetHash !== null) {
            targetHashes.set('instruction/AGENTS.md', targetHash);
          }

          // Addendum file (if it exists)
          if (instructions.addendum) {
            const addendumName = target === 'claude-code' ? 'claude' : target;
            sourceItems.push({
              type: 'instruction',
              name: `${addendumName}.md`,
              hash: sourceHash,
              targetPath: instructionsPath,
            });
            if (targetHash !== null) {
              targetHashes.set(`instruction/${addendumName}.md`, targetHash);
            }
          }
        }
      }
    }

    // Skills (only opencode supports skills currently)
    if (!options.types || options.types.includes('skill')) {
      if (caps.skills && 'renderSkill' in adapter) {
        const renderSkill = adapter.renderSkill as (item: CanonicalItem) => import('../types').RenderedFile;
        for (const item of skills) {
          const rendered = renderSkill(item);
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

    const diff = calculateDiff(sourceItems, targetHashes, manifest, target);
    diffs.push(diff);
  }

  const { output, hasDrift } = formatCheckResult(diffs, options.pretty ?? false);
  return { diffs, hasDrift, output };
}

/**
 * Run the push operation: render + write all drifted items with rollback on failure.
 */
export async function runPush(options: SyncOptions = {}): Promise<OrchestratorPushResult> {
  const projectDir = options.projectDir ?? cwd();
  const targets = options.targets && options.targets.length > 0 ? options.targets : ALL_TARGETS;
  const isExcluded = createExclusionFilter(['gsd-*', '.acsync-backup-*']);

  const manifest = await loadManifest(projectDir);

  // Load secrets
  const secretsResult = await loadSecrets(join(projectDir, '.env'));
  const secrets = secretsResult.secrets;

  // Discover canonical configs
  const [commands, agents, mcpServers, skills] = await Promise.all([
    readCanonicalCommands(projectDir, isExcluded),
    readCanonicalAgents(projectDir, isExcluded),
    readCanonicalMCPServers(projectDir),
    readCanonicalSkills(projectDir, isExcluded),
  ]);

  // Run check to find what needs writing
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
    const ops = diff.operations.filter((op) => op.type === 'create' || op.type === 'update');

    if (ops.length === 0) {
      pushResults.push({ target, operations: diff.operations, success: true });
      continue;
    }

    const targetBackups: BackupInfo[] = [];
    let targetFailed = false;
    let errorMsg: string | undefined;
    // Track paths already written (MCP/instructions share a path across ops)
    const writtenPaths = new Set<string>();

    try {
      for (const op of ops) {
        if (!op.targetPath) continue;

        // Skip if already written (multiple ops share one aggregate file)
        const alreadyWritten = writtenPaths.has(op.targetPath);

        if (!alreadyWritten) {
          // Backup existing file
          const backup = await createBackup(op.targetPath);
          targetBackups.push(backup);
          allBackups.push(backup);

          // Render content
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
            if (!caps.skills || !('renderSkill' in adapter)) continue;
            const item = skills.find((s) => s.name === op.name);
            if (!item) continue;
            const renderSkill = (adapter as { renderSkill: (item: CanonicalItem) => import('../types').RenderedFile }).renderSkill;
            content = renderSkill(item).content;
          } else {
            continue;
          }

          // Inject secrets
          const injected = injectSecrets(content, secrets);
          content = injected.result;

          // Write atomically
          const backupDir = join(projectDir, '.acsync', 'backups');
          await atomicWrite(op.targetPath, content, backupDir);
          writtenPaths.add(op.targetPath);
          totalWritten++;
        }

        // Update manifest for each logical item (even if file write was deduplicated)
        const sourceHash = op.newHash ?? hashContent(op.targetPath);
        const targetHash = sourceHash;
        updateManifestItem(manifest, op.itemType, op.name, sourceHash, target, targetHash);
      }

      pushResults.push({ target, operations: diff.operations, success: true });
    } catch (err) {
      targetFailed = true;
      totalFailed++;
      errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`Push failed for ${target}: ${errorMsg}`);
      console.error('Rolling back...');

      // Rollback all changes for this target
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
      // Cleanup backups for this successful target
      await cleanupAll(targetBackups);
    }
  }

  // Save manifest only on full success
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
