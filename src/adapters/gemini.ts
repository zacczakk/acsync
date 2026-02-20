import { BaseAdapter } from './base';
import { stringifyFrontmatter } from '../formats/markdown';
import type {
  CanonicalItem,
  MCPServer,
  RenderedFile,
  AdapterCapabilities,
} from '../types';

export class GeminiAdapter extends BaseAdapter {
  constructor() {
    super('gemini', 'Gemini');
  }

  getCapabilities(): AdapterCapabilities {
    return { commands: true, agents: true, mcp: true, instructions: true, skills: false };
  }

  renderCommand(item: CanonicalItem): RenderedFile {
    // Gemini commands: TOML format with triple-quoted prompt string
    // Strip allowed-tools and argument-hint from output
    // Always append "User arguments: {args}" at end of prompt
    const body = item.content.trim();
    const prompt = body + '\n\nUser arguments: {args}';
    const description = String(item.metadata.description ?? '');

    // Build TOML manually — smol-toml stringify doesn't produce triple-quoted strings
    const tomlContent = `description = ${JSON.stringify(description)}\nprompt = """\n${prompt}\n"""\n`;

    return {
      relativePath: this.paths.getCommandFilePath(item.name),
      content: tomlContent,
    };
  }

  renderAgent(item: CanonicalItem): RenderedFile {
    // Gemini agents: markdown with frontmatter, add kind: local
    // Keep description + allowed-tools, add kind: local
    const metadata: Record<string, unknown> = {};
    if (item.metadata.description) metadata.description = item.metadata.description;
    if (item.metadata['allowed-tools']) metadata['allowed-tools'] = item.metadata['allowed-tools'];
    metadata.kind = 'local';

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
