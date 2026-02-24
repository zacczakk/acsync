import os from 'node:os';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AdapterPathResolver } from './path-resolver';
import { parseFrontmatter, stringifyFrontmatter } from '../formats/markdown';
import { readSupportFiles } from '../infra/support-files';
import type {
  TargetName,
  CanonicalItem,
  MCPServer,
  RenderedFile,
  AdapterCapabilities,
} from '../types';

export interface ToolAdapter {
  readonly target: TargetName;
  readonly displayName: string;

  getCapabilities(): AdapterCapabilities;

  /** Render a single command item → path + content */
  renderCommand(item: CanonicalItem): RenderedFile;

  /** Render a single agent item → path + content */
  renderAgent(item: CanonicalItem): RenderedFile;

  /** Render all MCP servers → complete settings file content */
  renderMCPServers(servers: MCPServer[], existingContent?: string): string;

  /** Return names of servers that will be rendered (for diff display) */
  getRenderedServerNames(servers: MCPServer[]): string[];

  /** Parse server names from existing target MCP config content */
  parseExistingMCPServerNames(content: string): string[];

  /** Whether push overwrites the MCP section (true) or merges keys (false) */
  removesNonCanonicalOnPush(): boolean;

  /** Render instructions (identity passthrough — content is already unified) */
  renderInstructions(content: string): string;

  /** List logical command names from target's commands directory */
  listExistingCommandNames(): Promise<string[]>;

  /** List logical agent names from target's agents directory */
  listExistingAgentNames(): Promise<string[]>;

  /** Parse a target-format command file back to canonical CanonicalItem */
  parseCommand(name: string, content: string): CanonicalItem;

  /** Parse a target-format agent file back to canonical CanonicalItem */
  parseAgent(name: string, content: string): CanonicalItem;

  /** Render a skill → SKILL.md content (support files handled separately) */
  renderSkill(item: CanonicalItem): RenderedFile;

  /** List logical skill names from target's skills directory */
  listExistingSkillNames(): Promise<string[]>;

  /** Read a skill from target: SKILL.md + support files → CanonicalItem */
  readSkill(name: string): Promise<CanonicalItem>;

  /** Expose path resolver for orchestrator use */
  getPaths(): AdapterPathResolver;
}

export abstract class BaseAdapter implements ToolAdapter {
  readonly target: TargetName;
  readonly displayName: string;
  protected readonly paths: AdapterPathResolver;

  constructor(target: TargetName, displayName: string) {
    this.target = target;
    this.displayName = displayName;
    this.paths = new AdapterPathResolver(target);
  }

  abstract getCapabilities(): AdapterCapabilities;
  abstract renderCommand(item: CanonicalItem): RenderedFile;
  abstract renderAgent(item: CanonicalItem): RenderedFile;
  abstract renderMCPServers(servers: MCPServer[], existingContent?: string): string;

  /** Default: servers not in disabledFor and not globally disabled */
  getRenderedServerNames(servers: MCPServer[]): string[] {
    return servers
      .filter((s) => !s.disabledFor?.includes(this.target) && s.enabled !== false)
      .map((s) => s.name);
  }

  /** Map a command filename back to logical name (override per target) */
  protected commandNameFromFile(filename: string): string | null {
    if (filename.endsWith('.md')) return filename.slice(0, -3);
    return null;
  }

  /** Map an agent filename back to logical name */
  protected agentNameFromFile(filename: string): string | null {
    if (filename.endsWith('.md')) return filename.slice(0, -3);
    return null;
  }

  /** List logical command names from target commands dir */
  async listExistingCommandNames(): Promise<string[]> {
    const dir = this.paths.getCommandsDir();
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return [];
    }
    const names: string[] = [];
    for (const entry of entries) {
      const name = this.commandNameFromFile(entry);
      if (name) names.push(name);
    }
    return names;
  }

  /** List logical agent names from target agents dir */
  async listExistingAgentNames(): Promise<string[]> {
    const dir = this.paths.getAgentsDir();
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return [];
    }
    const names: string[] = [];
    for (const entry of entries) {
      const name = this.agentNameFromFile(entry);
      if (name) names.push(name);
    }
    return names;
  }

  /** Skills are identity-rendered: SKILL.md with frontmatter, no format change */
  renderSkill(item: CanonicalItem): RenderedFile {
    const content = stringifyFrontmatter(item.content, item.metadata);
    const skillDir = join(this.paths.getSkillsDir(), item.name);
    return {
      relativePath: join(skillDir, 'SKILL.md'),
      content,
    };
  }

  /** List skill directory names from target's skills dir */
  async listExistingSkillNames(): Promise<string[]> {
    const dir = this.paths.getSkillsDir();
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return [];
    }
    const names: string[] = [];
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      // Verify it's a directory with SKILL.md
      try {
        await readFile(join(dir, entry, 'SKILL.md'), 'utf-8');
        names.push(entry);
      } catch {
        // Not a valid skill directory
      }
    }
    return names;
  }

  /** Read a skill from target: SKILL.md + support files */
  async readSkill(name: string): Promise<CanonicalItem> {
    const dir = join(this.paths.getSkillsDir(), name);
    const raw = await readFile(join(dir, 'SKILL.md'), 'utf-8');
    const { data, content } = parseFrontmatter(raw);
    const supportFiles = await readSupportFiles(dir, 'SKILL.md');
    return { name, content, metadata: data, supportFiles };
  }

  /** Default parse: assume canonical format (markdown frontmatter) */
  parseCommand(name: string, content: string): CanonicalItem {
    const { data, content: body } = parseFrontmatter(content);
    return { name, content: body, metadata: data };
  }

  /** Default parse: assume canonical format (markdown frontmatter) */
  parseAgent(name: string, content: string): CanonicalItem {
    const { data, content: body } = parseFrontmatter(content);
    return { name, content: body, metadata: data };
  }

  /** Default: parse mcpServers keys from JSON config */
  parseExistingMCPServerNames(content: string): string[] {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const servers = parsed.mcpServers as Record<string, unknown> | undefined;
      return servers ? Object.keys(servers) : [];
    } catch {
      return [];
    }
  }

  /** Default: push overwrites mcpServers entirely (Claude/Gemini behavior) */
  removesNonCanonicalOnPush(): boolean {
    return true;
  }

  /** Render instructions (identity passthrough — content is already unified) */
  renderInstructions(content: string): string {
    return content;
  }

  /** Expose path resolver for orchestrator use */
  getPaths(): AdapterPathResolver {
    return this.paths;
  }

  /** Expand ~ in content strings */
  protected expandPaths(content: string): string {
    return content.replace(/~\//g, os.homedir() + '/');
  }
}
