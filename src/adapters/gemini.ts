import { BaseAdapter } from './base';
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
  constructor() {
    super('gemini', 'Gemini');
  }

  getCapabilities(): AdapterCapabilities {
    return { commands: true, agents: true, mcp: true, instructions: true, skills: true };
  }

  /** Gemini commands are TOML files: zz-plan.toml → zz-plan */
  protected override commandNameFromFile(filename: string): string | null {
    if (!filename.endsWith('.toml')) return null;
    return filename.slice(0, -5);
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

  /** Parse TOML command back to canonical: extract description + prompt body */
  override parseCommand(name: string, content: string): CanonicalItem {
    const parsed = readToml<{ description?: string; prompt?: string }>(content);
    let body = parsed.prompt ?? '';
    // Strip trailing "\n\nUser arguments: {args}\n" appended during render
    body = body.replace(/\n\nUser arguments: \{args\}\s*$/, '');
    return {
      name,
      content: body,
      metadata: { description: parsed.description ?? '' },
    };
  }

  renderMCPServers(servers: MCPServer[], existingContent?: string): string {
    // Filter out servers disabled for this target OR globally disabled
    // (Gemini has no native disabled mechanism)
    const filtered = servers.filter(
      (s) => !s.disabledFor?.includes('gemini') && s.enabled !== false,
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
