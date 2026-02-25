import os from 'node:os';
import { readdir, readFile } from 'node:fs/promises';
import { readJson, writeJson } from '../formats/json';
import { join } from 'node:path';
import { AdapterPathResolver } from './path-resolver';
import { parseFrontmatter, stringifyFrontmatter } from '../formats/markdown';
import { readSupportFiles } from '../infra/support-files';
import type {
  TargetName,
  CanonicalItem,
  CanonicalSettings,
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

  /**
   * Render settings: deep-merge canonical keys into existing target content.
   * Returns the full file content ready to write. Only touches canonical keys;
   * preserves all other keys in the target file.
   */
  renderSettings(settings: CanonicalSettings, existingContent?: string): string;

  /**
   * Extract canonical settings keys from target file content for hash comparison.
   * Returns a stable JSON string of only the canonical keys (sorted), so we can
   * compare source vs target without noise from non-canonical keys.
   */
  extractSettingsKeys(canonicalKeys: string[], targetContent: string): string;

  /** Parse target MCP config content back to canonical MCPServer[] */
  parseMCPServers(content: string): MCPServer[];

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

  /**
   * Default renderSettings: deep-merge canonical keys into existing JSON.
   * Preserves all non-canonical keys in the target file.
   */
  renderSettings(settings: CanonicalSettings, existingContent?: string): string {
    const base: Record<string, unknown> = existingContent
      ? readJson<Record<string, unknown>>(existingContent)
      : {};
    for (const [key, value] of Object.entries(settings.keys)) {
      base[key] = value;
    }
    return writeJson(base);
  }

  /**
   * Default extractSettingsKeys: pick canonical keys from target JSON,
   * return stable sorted JSON string for hash comparison.
   */
  extractSettingsKeys(canonicalKeys: string[], targetContent: string): string {
    const parsed = readJson<Record<string, unknown>>(targetContent);
    const extracted: Record<string, unknown> = {};
    for (const key of [...canonicalKeys].sort()) {
      if (key in parsed) {
        extracted[key] = parsed[key];
      }
    }
    return JSON.stringify(extracted, null, 2) + '\n';
  }

  /** Default: parse mcpServers from JSON config → canonical MCPServer[] */
  parseMCPServers(content: string): MCPServer[] {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const mcpServers = parsed.mcpServers as Record<string, Record<string, unknown>> | undefined;
      if (!mcpServers) return [];

      const servers: MCPServer[] = [];
      for (const [name, cfg] of Object.entries(mcpServers)) {
        const transport: 'stdio' | 'http' = cfg.command ? 'stdio' : 'http';
        const server: MCPServer = { name, transport };

        if (transport === 'stdio') {
          server.command = cfg.command as string;
          if (cfg.args) server.args = cfg.args as string[];
          if (cfg.env && typeof cfg.env === 'object') {
            server.env = cfg.env as Record<string, string>;
            server.envVars = Object.keys(cfg.env as Record<string, string>);
          }
        } else {
          server.url = cfg.url as string;
          if (cfg.headers && typeof cfg.headers === 'object') {
            server.headers = cfg.headers as Record<string, string>;
          }
        }

        servers.push(server);
      }
      return servers;
    } catch {
      return [];
    }
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
