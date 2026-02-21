import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readSupportFiles } from '../infra/support-files';
import { parseFrontmatter } from '../formats/markdown';
import { ClaudeCodeAdapter } from '../adapters/claude-code';
import { OpenCodeAdapter } from '../adapters/opencode';
import { GeminiAdapter } from '../adapters/gemini';
import { CodexAdapter } from '../adapters/codex';
import type { ToolAdapter } from '../adapters/base';
import type { TargetName, ItemType, CanonicalItem, MCPServer } from '../types';

export interface SyncOptions {
  targets?: TargetName[];       // --target flag (all if empty)
  types?: ItemType[];           // --type flag (all if empty)
  dryRun?: boolean;             // --dry-run
  force?: boolean;              // --force (skip confirmation)
  pretty?: boolean;             // --pretty (human output)
  projectDir?: string;          // project root (default cwd)
  deleteStale?: boolean;        // --delete (remove stale target files)
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

export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/** Hash a rendered file content to use as source hash */
export function hashRendered(content: string): string {
  return hashContent(content);
}

/** Try to hash an existing target file; return null if not found */
export async function hashTargetFile(filePath: string): Promise<string | null> {
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
