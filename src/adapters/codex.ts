import { BaseAdapter } from './base';
import type {
  CanonicalItem,
  MCPServer,
  RenderedFile,
  AdapterCapabilities,
} from '../types';

export class CodexAdapter extends BaseAdapter {
  constructor() {
    super('codex', 'Codex');
  }

  getCapabilities(): AdapterCapabilities {
    return { commands: true, agents: true, mcp: true, instructions: true, skills: false };
  }

  renderCommand(item: CanonicalItem): RenderedFile {
    // Codex commands: flat markdown, no frontmatter
    // # /{name} heading, description paragraph, then body
    const description = String(item.metadata.description ?? '');
    const body = item.content.trim();
    const content = `# /${item.name}\n\n${description}\n\n${body}\n`;

    return {
      relativePath: this.paths.getCommandFilePath(item.name),
      content,
    };
  }

  renderAgent(item: CanonicalItem): RenderedFile {
    // Codex agents: flat markdown, no frontmatter
    // # Agent: {name} heading
    // **Role**: description
    // **Allowed Tools**: tool1, tool2 (only if present)
    // Then body
    const description = String(item.metadata.description ?? '');
    const tools = item.metadata['allowed-tools'];
    const toolsLine = Array.isArray(tools) ? tools.join(', ') : String(tools ?? '');
    const body = item.content.trim();

    let content = `# Agent: ${item.name}\n\n**Role**: ${description}\n\n`;
    if (toolsLine) {
      content += `**Allowed Tools**: ${toolsLine}\n\n`;
    }
    content += `${body}\n`;

    return {
      relativePath: this.paths.getAgentFilePath(item.name),
      content,
    };
  }

  renderMCPServers(_servers: MCPServer[], _existingContent?: string): string {
    throw new Error('Not implemented — see Plan 03');
  }
}
