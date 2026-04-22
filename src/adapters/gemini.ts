import { BaseAdapter } from './base';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { stringifyFrontmatter } from '../formats/markdown';
import { readJson, writeJson } from '../formats/json';
import { readToml } from '../formats/toml';
import type {
  CanonicalItem,
  MCPServer,
  RenderedFile,
  AdapterCapabilities,
} from '../types';

export class GeminiAdapter extends BaseAdapter {
  constructor(homeDir?: string) {
    super('gemini', 'Gemini', homeDir);
  }

  getCapabilities(): AdapterCapabilities {
    return { commands: true, agents: true, mcp: true, instructions: true, skills: true, settings: false, plugins: false, hooks: false };
  }

  /** Gemini commands are TOML files: my-plan.toml → my-plan */
  protected override commandNameFromFile(filename: string): string | null {
    if (!filename.endsWith('.toml')) return null;
    return filename.slice(0, -5);
  }

  renderCommand(item: CanonicalItem): RenderedFile {
    // Gemini commands: TOML with literal multiline string (''') for prompt.
    // Literal strings treat backslashes as-is — no escape interpretation.
    // Triple-quoted basic strings (""") interpret \U, \n, etc., which breaks
    // content containing paths like C:\Users.
    const body = item.content.trim();
    const prompt = body + '\n\nUser arguments: {{args}}';
    const description = String(item.metadata.description ?? '');

    const tomlContent = `description = ${JSON.stringify(description)}\nprompt = '''\n${prompt}\n'''\n`;

    return {
      relativePath: this.paths.getCommandFilePath(item.name),
      content: tomlContent,
    };
  }

  renderAgent(item: CanonicalItem): RenderedFile {
    // Gemini agents: markdown with portable frontmatter plus kind: local
    const metadata = this.normalizeAgentMetadata(item);
    metadata.kind = 'local';

    const content = stringifyFrontmatter(item.content, metadata);
    return {
      relativePath: this.paths.getAgentFilePath(item.name),
      content,
    };
  }

  /** Parse TOML command back to canonical: extract description + prompt body */
  override parseCommand(name: string, content: string): CanonicalItem {
    const parsed = readToml<{ description?: string; prompt?: string }>(content);
    let body = parsed.prompt ?? '';
    // Strip trailing "\n\nUser arguments: {{args}}\n" appended during render
    body = body.replace(/\n\nUser arguments: \{\{args\}\}\s*$/, '');
    return {
      name,
      content: body,
      metadata: { description: parsed.description ?? '' },
    };
  }

  renderMCPServers(servers: MCPServer[], existingContent?: string): string {
    const filtered = servers.filter((s) => !s.disabledFor?.includes('gemini'));
    const excluded = filtered
      .filter((server) => server.enabled === false)
      .map((server) => server.name);

    const mcpServers: Record<string, unknown> = {};
    for (const server of filtered) {
      if (server.transport === 'stdio') {
        const cfg: Record<string, unknown> = { command: server.command, args: server.args ?? [] };
        if (server.env && Object.keys(server.env).length > 0) cfg.env = server.env;
        mcpServers[server.name] = cfg;
      } else {
        const cfg: Record<string, unknown> = { httpUrl: server.url };
        if (server.headers && Object.keys(server.headers).length > 0) cfg.headers = server.headers;
        mcpServers[server.name] = cfg;
      }
    }

    let base: Record<string, unknown> = {};
    if (existingContent) {
      base = readJson<Record<string, unknown>>(existingContent);
    }

    const mcp = typeof base.mcp === 'object' && base.mcp !== null && !Array.isArray(base.mcp)
      ? { ...(base.mcp as Record<string, unknown>) }
      : {};

    if (excluded.length > 0) {
      mcp.excluded = excluded;
    } else {
      delete mcp.excluded;
    }

    const next: Record<string, unknown> = { ...base, mcpServers };
    if (Object.keys(mcp).length > 0) next.mcp = mcp;
    else delete next.mcp;

    return writeJson(next);
  }

  override getRenderedServerNames(servers: MCPServer[]): string[] {
    return servers
      .filter((s) => !s.disabledFor?.includes('gemini'))
      .map((s) => s.name);
  }

  override parseMCPServers(content: string): MCPServer[] {
    try {
      const parsed = readJson<Record<string, unknown>>(content);
      const mcpServers = parsed.mcpServers as Record<string, Record<string, unknown>> | undefined;
      if (!mcpServers) return [];

      const excluded = new Set(this.getExcludedServerNames(parsed));
      const persistentlyDisabled = new Set(this.getPersistentlyDisabledServerNames());
      const servers: MCPServer[] = [];

      for (const [name, cfg] of Object.entries(mcpServers)) {
        const lowerName = name.toLowerCase();
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
          server.url = (cfg.httpUrl as string | undefined) ?? (cfg.url as string | undefined);
          if (cfg.headers && typeof cfg.headers === 'object') {
            server.headers = cfg.headers as Record<string, string>;
          }
        }

        if (
          cfg.enabled === false
          || excluded.has(lowerName)
          || persistentlyDisabled.has(lowerName)
        ) {
          server.enabled = false;
        }

        servers.push(server);
      }

      return servers;
    } catch {
      return [];
    }
  }

  private getExcludedServerNames(parsed: Record<string, unknown>): string[] {
    const mcp = parsed.mcp;
    if (typeof mcp !== 'object' || mcp === null || Array.isArray(mcp)) return [];
    const excluded = (mcp as Record<string, unknown>).excluded;
    if (!Array.isArray(excluded)) return [];

    return excluded
      .filter((name): name is string => typeof name === 'string')
      .map((name) => name.toLowerCase());
  }

  private getPersistentlyDisabledServerNames(): string[] {
    const enablementPath = path.join(this.paths.getBaseDir(), 'mcp-server-enablement.json');
    if (!existsSync(enablementPath)) return [];

    try {
      const parsed = readJson<Record<string, { enabled?: boolean }>>(readFileSync(enablementPath, 'utf-8'));
      return Object.entries(parsed)
        .filter(([, state]) => state?.enabled === false)
        .map(([name]) => name.toLowerCase());
    } catch {
      return [];
    }
  }
}
