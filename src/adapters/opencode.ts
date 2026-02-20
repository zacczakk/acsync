import { BaseAdapter } from './base';
import { stringifyFrontmatter } from '../formats/markdown';
import { modifyJsonc } from '../formats/jsonc';
import { EnvVarTransformer } from '../secrets/env-var-transformer';
import type {
  CanonicalItem,
  MCPServer,
  RenderedFile,
  AdapterCapabilities,
} from '../types';

export class OpenCodeAdapter extends BaseAdapter {
  constructor() {
    super('opencode', 'OpenCode');
  }

  getCapabilities(): AdapterCapabilities {
    return { commands: true, agents: true, mcp: true, instructions: true, skills: true };
  }

  renderCommand(item: CanonicalItem): RenderedFile {
    // Rebuild frontmatter: keep description only
    // Strip: allowed-tools, argument-hint (OpenCode commands don't use these)
    const metadata: Record<string, unknown> = {};
    if (item.metadata.description) metadata.description = item.metadata.description;

    const content = stringifyFrontmatter(item.content, metadata);
    return {
      relativePath: this.paths.getCommandFilePath(item.name),
      content,
    };
  }

  renderAgent(item: CanonicalItem): RenderedFile {
    // Strip name + allowed-tools, add mode: subagent
    const metadata: Record<string, unknown> = {};
    if (item.metadata.description) metadata.description = item.metadata.description;
    metadata.mode = 'subagent';

    const content = stringifyFrontmatter(item.content, metadata);
    return {
      relativePath: this.paths.getAgentFilePath(item.name),
      content,
    };
  }

  renderMCPServers(servers: MCPServer[], existingContent?: string): string {
    const filtered = servers.filter((s) => !s.disabledFor?.includes('opencode'));

    let text = existingContent ?? '{}';

    // Ensure mcp object exists
    text = modifyJsonc(text, ['mcp'], {}) as string;

    for (const server of filtered) {
      const cfg: Record<string, unknown> = {
        type: server.transport === 'stdio' ? 'local' : 'remote',
      };

      if (server.transport === 'stdio') {
        cfg.command = [server.command, ...(server.args ?? [])];
      } else {
        cfg.url = server.url;
      }

      if (server.env && Object.keys(server.env).length > 0) {
        cfg.environment = EnvVarTransformer.toOpenCode(server.env) as Record<string, string>;
      }

      text = modifyJsonc(text, ['mcp', server.name], cfg) as string;
    }

    return text;
  }
}
