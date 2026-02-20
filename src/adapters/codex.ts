import { BaseAdapter } from './base';
import { writeToml } from '../formats/toml';
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
