import { readdir, readFile, mkdir, unlink, rm } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { cwd } from 'node:process';
import { createHash } from 'node:crypto';
import pc from 'picocolors';
import { readSupportFiles, writeSupportFiles } from '../infra/support-files';
import { loadManifest, saveManifest, updateManifestItem } from '../core/manifest';
import { calculateDiff } from '../core/diff';
import { createBackup, restoreAll, cleanupAll } from '../core/rollback';
import { formatCheckResult, formatDryRunResult, formatPushResult } from '../core/formatter';
import type { PushTargetResult } from '../core/formatter';
import { atomicWrite } from '../infra/atomic-write';
import { createExclusionFilter, classifyEntry } from '../infra/exclusion';
import { parseFrontmatter, stringifyFrontmatter } from '../formats/markdown';
import { ClaudeCodeAdapter } from '../adapters/claude-code';
import { OpenCodeAdapter } from '../adapters/opencode';
import { GeminiAdapter } from '../adapters/gemini';
import { CodexAdapter } from '../adapters/codex';
import type { ToolAdapter } from '../adapters/base';
import type { TargetName, ItemType, CanonicalItem, MCPServer, MCPWarning, Operation } from '../types';
import type { SourceItem } from '../core/diff';
import type { BackupInfo } from '../core/rollback';

export interface SyncOptions {
  targets?: TargetName[];       // --target flag (all if empty)
  types?: ItemType[];           // --type flag (all if empty)
  dryRun?: boolean;             // --dry-run
  force?: boolean;              // --force (skip confirmation)
  pretty?: boolean;             // --pretty (human output)
  projectDir?: string;          // project root (default cwd)
  deleteStale?: boolean;        // --delete (remove stale target files)
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
  output: string;
}

export const ALL_TARGETS: TargetName[] = ['claude-code', 'opencode', 'gemini', 'codex'];

export function createAdapter(target: TargetName): ToolAdapter {
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
export async function readCanonicalCommands(
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
export async function readCanonicalAgents(
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
export async function readCanonicalMCPServers(projectDir: string): Promise<MCPServer[]> {
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
export async function readCanonicalInstructions(
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
export async function readCanonicalSkills(
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
    if (entry.startsWith('.')) continue;
    const skillDir = join(dir, entry);
    const skillMdPath = join(skillDir, 'SKILL.md');
    try {
      const raw = await readFile(skillMdPath, 'utf-8');
      const { data, content } = parseFrontmatter(raw);
      const supportFiles = await readSupportFiles(skillDir, 'SKILL.md');
      items.push({ name: entry, content, metadata: data, supportFiles });
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

/**
 * Detect stale items in a target directory that aren't in the canonical source.
 * Returns delete operations for non-canonical, non-excluded items.
 *
 * Safety: only detects stale items for item types that have at least one
 * canonical item. An empty canonical source means the project doesn't
 * manage that type — never flag real items as stale.
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

  if ((!types || types.includes('command')) && canonicalCommandNames.size > 0) {
    const existingCommands = await adapter.listExistingCommandNames();
    for (const name of existingCommands) {
      const entry = classifyEntry(name, canonicalCommandNames, isExcluded);
      if (entry.status === 'non-canonical') {
        deleteOps.push({
          type: 'delete',
          itemType: 'command',
          name,
          target: adapter.target,
          reason: 'Item not in canonical source (stale)',
          targetPath: paths.getCommandFilePath(name),
        });
      }
    }
  }

  if ((!types || types.includes('agent')) && canonicalAgentNames.size > 0) {
    const existingAgents = await adapter.listExistingAgentNames();
    for (const name of existingAgents) {
      const entry = classifyEntry(name, canonicalAgentNames, isExcluded);
      if (entry.status === 'non-canonical') {
        deleteOps.push({
          type: 'delete',
          itemType: 'agent',
          name,
          target: adapter.target,
          reason: 'Item not in canonical source (stale)',
          targetPath: paths.getAgentFilePath(name),
        });
      }
    }
  }

  if ((!types || types.includes('skill')) && caps.skills && canonicalSkillNames.size > 0) {
    const existingSkills = await adapter.listExistingSkillNames();
    for (const name of existingSkills) {
      const entry = classifyEntry(name, canonicalSkillNames, isExcluded);
      if (entry.status === 'non-canonical') {
        deleteOps.push({
          type: 'delete',
          itemType: 'skill',
          name,
          target: adapter.target,
          reason: 'Item not in canonical source (stale)',
          targetPath: join(paths.getSkillsDir(), name),
        });
      }
    }
  }

  return deleteOps;
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
    let mcpWarning: MCPWarning | undefined;
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

        // Detect non-canonical servers in existing target config
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

    const diff = calculateDiff(sourceItems, targetHashes, manifest, target);
    if (mcpWarning) diff.mcpWarning = mcpWarning;

    // Detect stale items (exist in target but not in canonical)
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
    const writeOps = diff.operations.filter((op) => op.type === 'create' || op.type === 'update');
    const deleteOps = diff.operations.filter((op) => op.type === 'delete');

    if (writeOps.length === 0 && deleteOps.length === 0) {
      pushResults.push({ target, operations: diff.operations, success: true });
      continue;
    }

    const targetBackups: BackupInfo[] = [];
    let targetFailed = false;
    let errorMsg: string | undefined;
    // Track paths already written (MCP/instructions share a path across ops)
    const writtenPaths = new Set<string>();

    try {
      for (const op of writeOps) {
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
            if (!caps.skills) continue;
            const item = skills.find((s) => s.name === op.name);
            if (!item) continue;
            content = adapter.renderSkill(item).content;
            // Write support files alongside SKILL.md
            if (item.supportFiles && item.supportFiles.length > 0) {
              const skillDir = join(adapter.getPaths().getSkillsDir(), item.name);
              await mkdir(skillDir, { recursive: true });
              await writeSupportFiles(skillDir, item.supportFiles);
            }
          } else {
            continue;
          }

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

      // Delete stale items (only when --delete flag is set)
      if (options.deleteStale) {
        for (const op of deleteOps) {
          if (!op.targetPath) continue;
          if (op.itemType === 'skill') {
            // Skills are directories — backup SKILL.md, then rm -rf the dir
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

/** Map internal target name to user-facing display name */
function displayTarget(target: TargetName): string {
  return target === 'claude-code' ? 'claude' : target;
}

/**
 * Pull commands/agents from a target CLI back into canonical format.
 * Reads from installed target configs, writes to configs/common/.
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
    const cmdDir = join(projectDir, 'configs', 'common', 'commands');
    try {
      for (const entry of await readdir(cmdDir)) {
        if (entry.endsWith('.md')) existingCommandNames.add(entry.slice(0, -3));
      }
    } catch { /* dir doesn't exist yet */ }

    const agentDir = join(projectDir, 'configs', 'common', 'agents');
    try {
      for (const entry of await readdir(agentDir)) {
        if (entry.endsWith('.md')) existingAgentNames.add(entry.slice(0, -3));
      }
    } catch { /* dir doesn't exist yet */ }

    const skillDir = join(projectDir, 'configs', 'common', 'skills');
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

  // Pull commands
  const commandNames = await adapter.listExistingCommandNames();
  for (const name of commandNames) {
    if (isExcluded(name)) continue;
    if (options.onlyKeys && !options.onlyKeys.has(`command/${name}`)) continue;

    const filePath = paths.getCommandFilePath(name);
    const targetPath = join(projectDir, 'configs', 'common', 'commands', `${name}.md`);

    if (!options.force && existingCommandNames.has(name)) {
      items.push({ type: 'command', name, action: 'skip', targetPath });
      continue;
    }

    items.push({ type: 'command', name, action: 'create', targetPath });

    if (!options.dryRun) {
      const content = await readFile(filePath, 'utf-8');
      const canonical = adapter.parseCommand(name, content);
      const output = stringifyFrontmatter(canonical.content, canonical.metadata);
      await mkdir(join(projectDir, 'configs', 'common', 'commands'), { recursive: true });
      await Bun.write(targetPath, output);
    }
  }

  // Pull agents
  const agentNames = await adapter.listExistingAgentNames();
  for (const name of agentNames) {
    if (isExcluded(name)) continue;
    if (options.onlyKeys && !options.onlyKeys.has(`agent/${name}`)) continue;

    const filePath = paths.getAgentFilePath(name);
    const targetPath = join(projectDir, 'configs', 'common', 'agents', `${name}.md`);

    if (!options.force && existingAgentNames.has(name)) {
      items.push({ type: 'agent', name, action: 'skip', targetPath });
      continue;
    }

    items.push({ type: 'agent', name, action: 'create', targetPath });

    if (!options.dryRun) {
      const content = await readFile(filePath, 'utf-8');
      const canonical = adapter.parseAgent(name, content);
      const output = stringifyFrontmatter(canonical.content, canonical.metadata);
      await mkdir(join(projectDir, 'configs', 'common', 'agents'), { recursive: true });
      await Bun.write(targetPath, output);
    }
  }

  // Pull skills (if target supports them)
  const caps = adapter.getCapabilities();
  if (caps.skills) {
    const skillNames = await adapter.listExistingSkillNames();
    for (const name of skillNames) {
      if (isExcluded(name)) continue;
      if (options.onlyKeys && !options.onlyKeys.has(`skill/${name}`)) continue;

      const targetPath = join(projectDir, 'configs', 'common', 'skills', name, 'SKILL.md');

      if (!options.force && existingSkillNames.has(name)) {
        items.push({ type: 'skill', name, action: 'skip', targetPath });
        continue;
      }

      items.push({ type: 'skill', name, action: 'create', targetPath });

      if (!options.dryRun) {
        const skill = await adapter.readSkill(name);
        const output = stringifyFrontmatter(skill.content, skill.metadata);
        const skillDir = join(projectDir, 'configs', 'common', 'skills', name);
        await mkdir(skillDir, { recursive: true });
        await Bun.write(join(skillDir, 'SKILL.md'), output);
        if (skill.supportFiles && skill.supportFiles.length > 0) {
          await writeSupportFiles(skillDir, skill.supportFiles);
        }
      }
    }
  }

  const pulled = items.filter((i) => i.action === 'create').length;
  const skipped = items.filter((i) => i.action === 'skip').length;

  // Format output
  const output = formatPullResult(items, options.source, options.pretty ?? false, options.dryRun ?? false);

  return { items, pulled, skipped, dryRun: options.dryRun ?? false, output };
}

export interface PullAllOptions {
  force?: boolean;
  dryRun?: boolean;
  pretty?: boolean;
  projectDir?: string;
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

  // Discovery: dry-run all targets to find available items
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

  // Deduplicate: first source wins per item key
  const seen = new Set<string>();
  const allItems: PullItem[] = [];
  const winnersPerTarget = new Map<TargetName, Set<string>>(); // target → set of names to pull

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

  // Dry-run: just format and return
  if (options.dryRun) {
    const output = formatPullAllResult(allItems, options.pretty ?? false, true);
    return { items: allItems, pulled: totalPulled, skipped: totalSkipped, dryRun: true, output };
  }

  // Write pass: pull each target's winners only via onlyKeys filter.
  // Each target only writes items assigned to it by dedup. No overwrites.
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
  return { items: allItems, pulled: totalPulled, skipped: totalSkipped, dryRun: false, output };
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

  // Group by source target
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
