import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { readSupportFiles } from '../infra/support-files';
import { parseFrontmatter } from '../formats/markdown';
import { ClaudeCodeAdapter } from '../adapters/claude-code';
import { OpenCodeAdapter } from '../adapters/opencode';
import { GeminiAdapter } from '../adapters/gemini';
import { CodexAdapter } from '../adapters/codex';
import type { ToolAdapter } from '../adapters/base';
import type { TargetName, ItemType, CanonicalItem, CanonicalSettings, MCPServer } from '../types';

/** Repo root — resolved from module location so acsync works from any cwd */
export const PROJECT_ROOT = resolve(import.meta.dir, '..', '..');

/** Canonical config root — single source of truth for all config paths */
const CANONICAL_ROOT = 'configs';

/** Subdirectory constants — import these instead of string-concatenating paths */
export const COMMANDS_DIR = join(CANONICAL_ROOT, 'commands');
export const AGENTS_DIR = join(CANONICAL_ROOT, 'agents');
export const MCP_DIR = join(CANONICAL_ROOT, 'mcp');
export const INSTRUCTIONS_DIR = join(CANONICAL_ROOT, 'instructions');
export const SKILLS_DIR = join(CANONICAL_ROOT, 'skills');
export const SETTINGS_DIR = join(CANONICAL_ROOT, 'settings');

export interface SyncOptions {
  targets?: TargetName[];       // --target flag (all if empty)
  types?: ItemType[];           // --type flag (all if empty)
  dryRun?: boolean;             // --dry-run
  force?: boolean;              // --force (skip confirmation)
  pretty?: boolean;             // --pretty (human output, default)
  json?: boolean;               // --json (machine output)
  verbose?: boolean;            // --verbose (show up-to-date items)
  projectDir?: string;          // project root (default: repo root via import.meta.dir)
  deleteStale?: boolean;        // --delete (remove stale target files)
  homeDir?: string;             // override home directory (for test isolation)
}

export const ALL_TARGETS: TargetName[] = ['claude-code', 'opencode', 'gemini', 'codex'];

export function createAdapter(target: TargetName, homeDir?: string): ToolAdapter {
  switch (target) {
    case 'claude-code': return new ClaudeCodeAdapter(homeDir);
    case 'opencode':    return new OpenCodeAdapter(homeDir);
    case 'gemini':      return new GeminiAdapter(homeDir);
    case 'codex':       return new CodexAdapter(homeDir);
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
 * Read canonical commands from configs/commands/*.md
 * Returns CanonicalItem[] with name from filename (without .md)
 */
export async function readCanonicalCommands(
  projectDir: string,
  isExcluded: (name: string) => boolean,
): Promise<CanonicalItem[]> {
  const dir = join(projectDir, COMMANDS_DIR);
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
 * Read canonical agents from configs/agents/*.md
 */
export async function readCanonicalAgents(
  projectDir: string,
  isExcluded: (name: string) => boolean,
): Promise<CanonicalItem[]> {
  const dir = join(projectDir, AGENTS_DIR);
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
 * Read canonical MCP servers from configs/mcp/*.json
 */
export async function readCanonicalMCPServers(projectDir: string): Promise<MCPServer[]> {
  const dir = join(projectDir, MCP_DIR);
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
 * Read canonical instructions from unified configs/instructions/AGENTS.md
 */
export async function readCanonicalInstructions(
  projectDir: string,
): Promise<string | null> {
  const filePath = join(projectDir, INSTRUCTIONS_DIR, 'AGENTS.md');
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/** Map target name to canonical settings filename */
function settingsFileName(target: TargetName): string {
  switch (target) {
    case 'claude-code': return 'claude.json';
    default:            return `${target}.json`;
  }
}

/**
 * Read canonical settings for a specific target from configs/settings/{target}.json
 * Returns null if no canonical settings file exists for the target.
 */
export async function readCanonicalSettings(
  projectDir: string,
  target: TargetName,
): Promise<CanonicalSettings | null> {
  const filePath = join(projectDir, SETTINGS_DIR, settingsFileName(target));
  try {
    const raw = await readFile(filePath, 'utf-8');
    const keys = JSON.parse(raw) as Record<string, unknown>;
    return { target, keys };
  } catch {
    return null;
  }
}

/**
 * Read canonical skills from configs/skills/ directories
 * Each skill is a directory with a SKILL.md file
 */
export async function readCanonicalSkills(
  projectDir: string,
  isExcluded: (name: string) => boolean,
): Promise<CanonicalItem[]> {
  const dir = join(projectDir, SKILLS_DIR);
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
