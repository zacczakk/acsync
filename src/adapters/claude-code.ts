import { BaseAdapter } from './base';
import { stringifyFrontmatter } from '../formats/markdown';
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
    // Path naming: strip zz- prefix, nest under zz/ (handled by PathResolver)
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

  renderMCPServers(_servers: MCPServer[], _existingContent?: string): string {
    throw new Error('Not implemented — see Plan 03');
  }
}
