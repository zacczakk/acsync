import { BaseAdapter } from './base';
import { stringifyFrontmatter } from '../formats/markdown';
import { readJson, writeJson } from '../formats/json';
import type {
  CanonicalItem,
  MCPServer,
  RenderedFile,
  AdapterCapabilities,
} from '../types';

export class ClaudeCodeAdapter extends BaseAdapter {
  constructor() {
    super('claude-code', 'Claude Code');
  }

  getCapabilities(): AdapterCapabilities {
    return { commands: true, agents: true, mcp: true, instructions: true, skills: true };
  }

  renderCommand(item: CanonicalItem): RenderedFile {
    // All frontmatter keys pass through verbatim (description, argument-hint, allowed-tools)
    // Body is verbatim — no modifications
    const content = stringifyFrontmatter(item.content, item.metadata);
    return {
      relativePath: this.paths.getCommandFilePath(item.name),
      content,
    };
  }

  renderAgent(item: CanonicalItem): RenderedFile {
    // All frontmatter keys pass through verbatim
    // Body is verbatim
    const content = stringifyFrontmatter(item.content, item.metadata);
    return {
      relativePath: this.paths.getAgentFilePath(item.name),
      content,
    };
  }

  renderMCPServers(servers: MCPServer[], existingContent?: string): string {
    // Filter out servers disabled for this target OR globally disabled
    // (Claude Code has no native disabled mechanism)
    const filtered = servers.filter(
      (s) => !s.disabledFor?.includes('claude-code') && s.enabled !== false,
    );

    const mcpServers: Record<string, unknown> = {};
    for (const server of filtered) {
      if (server.transport === 'stdio') {
        const cfg: Record<string, unknown> = { command: server.command, args: server.args ?? [] };
        if (server.env && Object.keys(server.env).length > 0) cfg.env = server.env;
        mcpServers[server.name] = cfg;
      } else {
        const cfg: Record<string, unknown> = { url: server.url };
        if (server.headers && Object.keys(server.headers).length > 0) cfg.headers = server.headers;
        mcpServers[server.name] = cfg;
      }
    }

    let base: Record<string, unknown> = {};
    if (existingContent) {
      base = readJson<Record<string, unknown>>(existingContent);
    }

    return writeJson({ ...base, mcpServers });
  }
}
