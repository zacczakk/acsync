import { BaseAdapter } from './base';
import { stringifyFrontmatter } from '../formats/markdown';
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

  renderMCPServers(_servers: MCPServer[], _existingContent?: string): string {
    throw new Error('Not implemented — see Plan 03');
  }
}
