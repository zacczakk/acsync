import { BaseAdapter } from './base';
import { readToml, writeToml } from '../formats/toml';
import type {
  CanonicalItem,
  MCPServer,
  RenderedFile,
  AdapterCapabilities,
} from '../types';

/** Extract bare variable name from "Bearer ${VAR_NAME}" Authorization header value */
function extractBearerTokenVar(authHeader: string): string | undefined {
  const match = /^Bearer\s+\$\{([A-Za-z0-9_]+)\}$/.exec(authHeader.trim());
  return match ? match[1] : undefined;
}

export class CodexAdapter extends BaseAdapter {
  constructor() {
    super('codex', 'Codex');
  }

  getCapabilities(): AdapterCapabilities {
    return { commands: true, agents: true, mcp: true, instructions: true, skills: true };
  }

  /** Codex commands: any .md that isn't agent-prefixed */
  protected override commandNameFromFile(filename: string): string | null {
    if (filename.startsWith('agent-')) return null;
    if (!filename.endsWith('.md')) return null;
    return filename.slice(0, -3);
  }

  /** Codex agents are prefixed: agent-zz-planner.md → zz-planner */
  protected override agentNameFromFile(filename: string): string | null {
    if (!filename.startsWith('agent-') || !filename.endsWith('.md')) return null;
    return filename.slice(6, -3); // strip "agent-" and ".md"
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

  /** Parse flat markdown command: # /{name}\n\n{description}\n\n{body} */
  override parseCommand(name: string, content: string): CanonicalItem {
    const lines = content.split('\n');
    // Skip heading line (# /{name}) and blank line after it
    let idx = 0;
    if (lines[idx]?.startsWith('# /')) idx++;
    while (idx < lines.length && lines[idx]?.trim() === '') idx++;
    // Next non-blank paragraph is description
    const descLines: string[] = [];
    while (idx < lines.length && lines[idx]?.trim() !== '') {
      descLines.push(lines[idx]!);
      idx++;
    }
    // Skip blank lines
    while (idx < lines.length && lines[idx]?.trim() === '') idx++;
    // Rest is body
    const body = lines.slice(idx).join('\n').replace(/\n+$/, '');
    return {
      name,
      content: body,
      metadata: { description: descLines.join('\n') },
    };
  }

  /** Parse flat markdown agent: # Agent: {name}\n\n**Role**: {desc}\n\n[**Allowed Tools**: ...]\n\n{body} */
  override parseAgent(name: string, content: string): CanonicalItem {
    const lines = content.split('\n');
    let idx = 0;
    // Skip heading (# Agent: {name})
    if (lines[idx]?.startsWith('# Agent:')) idx++;
    while (idx < lines.length && lines[idx]?.trim() === '') idx++;
    // Parse **Role**: description
    let description = '';
    if (lines[idx]?.startsWith('**Role**:')) {
      description = lines[idx]!.replace(/^\*\*Role\*\*:\s*/, '');
      idx++;
    }
    while (idx < lines.length && lines[idx]?.trim() === '') idx++;
    // Parse optional **Allowed Tools**: ...
    const metadata: Record<string, unknown> = { description };
    if (lines[idx]?.startsWith('**Allowed Tools**:')) {
      const toolsStr = lines[idx]!.replace(/^\*\*Allowed Tools\*\*:\s*/, '');
      metadata['allowed-tools'] = toolsStr.split(',').map((t) => t.trim()).filter(Boolean);
      idx++;
    }
    while (idx < lines.length && lines[idx]?.trim() === '') idx++;
    // Rest is body
    const body = lines.slice(idx).join('\n').replace(/\n+$/, '');
    return { name, content: body, metadata };
  }

  /** Codex uses mcp_servers in TOML */
  override parseExistingMCPServerNames(content: string): string[] {
    try {
      const parsed = readToml<Record<string, unknown>>(content);
      const servers = parsed.mcp_servers as Record<string, unknown> | undefined;
      return servers ? Object.keys(servers) : [];
    } catch {
      return [];
    }
  }

  /** Codex only renders HTTP servers */
  override getRenderedServerNames(servers: MCPServer[]): string[] {
    return servers
      .filter((s) => s.transport === 'http' && !s.disabledFor?.includes('codex') && s.enabled !== false)
      .map((s) => s.name);
  }

  renderMCPServers(servers: MCPServer[], _existingContent?: string): string {
    // Codex supports HTTP-only — skip all stdio servers and globally disabled
    const filtered = servers.filter(
      (s) => s.transport === 'http' && !s.disabledFor?.includes('codex') && s.enabled !== false,
    );

    if (filtered.length === 0) return '';

    const mcp_servers: Record<string, unknown> = {};
    for (const server of filtered) {
      const cfg: Record<string, unknown> = { url: server.url };

      // env_vars: array of bare variable names
      if (server.envVars && server.envVars.length > 0) {
        cfg.env_vars = server.envVars;
      }

      // bearer_token_env_var: extracted from Authorization header
      if (server.headers?.Authorization) {
        const bearerVar = extractBearerTokenVar(server.headers.Authorization);
        if (bearerVar) {
          cfg.bearer_token_env_var = bearerVar;
        }
      }

      mcp_servers[server.name] = cfg;
    }

    return writeToml({ mcp_servers });
  }
}
