import { BaseAdapter } from './base';
import { readToml, writeToml } from '../formats/toml';
import { join } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { parseFrontmatter } from '../formats/markdown';
import { readSupportFiles } from '../infra/support-files';
import { isPlainObject, deepMergeObjects } from './merge';
import type {
  CanonicalItem,
  MCPServer,
  RenderedFile,
  AdapterCapabilities,
  CanonicalSettings,
} from '../types';

/** Extract bare variable name from "Bearer ${VAR_NAME}" Authorization header value */
function extractBearerTokenVar(authHeader: string): string | undefined {
  const match = /^Bearer\s+\$\{([A-Za-z0-9_]+)\}$/.exec(authHeader.trim());
  return match ? match[1] : undefined;
}

function extractEnvVarPlaceholder(value: string): string | undefined {
  const match = /^\$\{([A-Za-z0-9_]+)\}$/.exec(value.trim());
  return match ? match[1] : undefined;
}

function extractEnvVarName(entry: unknown): string | undefined {
  if (typeof entry === 'string') return entry;
  if (!entry || typeof entry !== 'object') return undefined;

  const name = (entry as Record<string, unknown>).name;
  return typeof name === 'string' ? name : undefined;
}

export class CodexAdapter extends BaseAdapter {
  constructor(homeDir?: string) {
    super('codex', 'Codex', homeDir);
  }

  getCapabilities(): AdapterCapabilities {
    return { commands: true, agents: true, mcp: true, instructions: true, skills: true, settings: true, plugins: false, hooks: true };
  }

  override renderSettings(settings: CanonicalSettings, existingContent?: string): string {
    const base: Record<string, unknown> = existingContent
      ? readToml<Record<string, unknown>>(existingContent)
      : {};

    for (const [key, value] of Object.entries(settings.keys)) {
      if (isPlainObject(value) && isPlainObject(base[key])) {
        base[key] = deepMergeObjects(base[key] as Record<string, unknown>, value as Record<string, unknown>);
      } else {
        base[key] = value;
      }
    }

    return writeToml(base);
  }

  override extractSettingsKeys(canonicalKeys: string[], targetContent: string): string {
    const parsed = readToml<Record<string, unknown>>(targetContent);
    const extracted: Record<string, unknown> = {};
    for (const key of [...canonicalKeys].sort()) {
      if (key in parsed) {
        extracted[key] = parsed[key];
      }
    }
    return JSON.stringify(extracted, null, 2) + '\n';
  }

  override renderHooks(hooks: { content: string }): string {
    return hooks.content.trimEnd() + '\n';
  }

  override extractHooks(targetContent: string): string {
    try {
      const parsed = JSON.parse(targetContent) as Record<string, unknown>;
      return JSON.stringify(parsed, null, 2) + '\n';
    } catch {
      return targetContent;
    }
  }

  /** Codex commands: any .md that isn't agent-prefixed */
  protected override commandNameFromFile(filename: string): string | null {
    if (filename.startsWith('agent-')) return null;
    if (!filename.endsWith('.md')) return null;
    return filename.slice(0, -3);
  }

  /** Codex agents are standalone TOML files: my-planner.toml → my-planner */
  protected override agentNameFromFile(filename: string): string | null {
    if (!filename.endsWith('.toml')) return null;
    return filename.slice(0, -5);
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
    const content = item.content.trim();
    const metadata = item.metadata;
    const rendered: Record<string, unknown> = {
      name: item.name,
      description: String(metadata.description ?? ''),
      developer_instructions: content,
    };

    const nicknameCandidates = metadata.nickname_candidates;
    if (Array.isArray(nicknameCandidates) && nicknameCandidates.length > 0) {
      rendered.nickname_candidates = nicknameCandidates.map(String);
    }

    const model = metadata.model;
    if (typeof model === 'string' && !model.includes('/')) {
      rendered.model = model;
    }

    if (typeof metadata.model_reasoning_effort === 'string') {
      rendered.model_reasoning_effort = metadata.model_reasoning_effort;
    }

    const sandboxMode = this.deriveSandboxMode(metadata);
    if (sandboxMode) {
      rendered.sandbox_mode = sandboxMode;
    }

    if (metadata.mcp_servers && typeof metadata.mcp_servers === 'object') {
      rendered.mcp_servers = metadata.mcp_servers;
    }

    if (metadata.skills && typeof metadata.skills === 'object') {
      rendered.skills = metadata.skills;
    }

    return {
      relativePath: this.paths.getAgentFilePath(item.name),
      content: writeToml(rendered),
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

  /** Parse Codex agent TOML, with legacy flat-markdown fallback */
  override parseAgent(name: string, content: string): CanonicalItem {
    if (content.trimStart().startsWith('# Agent:')) {
      return this.parseLegacyAgent(name, content);
    }

    try {
      const parsed = readToml<Record<string, unknown>>(content);
      const metadata: Record<string, unknown> = {};

      if (typeof parsed.description === 'string') {
        metadata.description = parsed.description;
      }
      if (typeof parsed.model === 'string') {
        metadata.model = parsed.model;
      }
      if (typeof parsed.model_reasoning_effort === 'string') {
        metadata.model_reasoning_effort = parsed.model_reasoning_effort;
      }
      if (typeof parsed.sandbox_mode === 'string') {
        metadata.sandbox_mode = parsed.sandbox_mode;
      }
      if (Array.isArray(parsed.nickname_candidates)) {
        metadata.nickname_candidates = parsed.nickname_candidates;
      }
      if (parsed.mcp_servers && typeof parsed.mcp_servers === 'object') {
        metadata.mcp_servers = parsed.mcp_servers;
      }
      if (parsed.skills && typeof parsed.skills === 'object') {
        metadata.skills = parsed.skills;
      }

      const body = typeof parsed.developer_instructions === 'string'
        ? parsed.developer_instructions.replace(/\n+$/, '')
        : '';

      return { name, content: body, metadata };
    } catch {
      return this.parseLegacyAgent(name, content);
    }
  }

  override async readAgentFile(name: string): Promise<string> {
    try {
      return await readFile(this.paths.getAgentFilePath(name), 'utf-8');
    } catch {
      return readFile(this.legacyAgentFilePath(name), 'utf-8');
    }
  }

  override async listExistingSkillNames(): Promise<string[]> {
    const names = new Set<string>();
    for (const dir of [this.paths.getSkillsDir(), this.legacySkillsDir()]) {
      try {
        const entries = await readdir(dir);
        for (const entry of entries) {
          if (entry.startsWith('.')) continue;
          try {
            await readFile(join(dir, entry, 'SKILL.md'), 'utf-8');
            names.add(entry);
          } catch {
            // Not a valid skill directory
          }
        }
      } catch {
        // ignore
      }
    }
    return [...names];
  }

  override async readSkill(name: string): Promise<CanonicalItem> {
    try {
      return await super.readSkill(name);
    } catch {
      const dir = join(this.legacySkillsDir(), name);
      const raw = await readFile(join(dir, 'SKILL.md'), 'utf-8');
      const { data, content } = parseFrontmatter(raw);
      const supportFiles = await readSupportFiles(dir, 'SKILL.md');
      return { name, content, metadata: data, supportFiles };
    }
  }

  private parseLegacyAgent(name: string, content: string): CanonicalItem {
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

  private deriveSandboxMode(metadata: Record<string, unknown>): string | undefined {
    if (typeof metadata.sandbox_mode === 'string') {
      return metadata.sandbox_mode;
    }

    const permission = metadata.permission;
    if (!permission || typeof permission !== 'object') return undefined;

    return (permission as Record<string, unknown>).edit === 'deny' ? 'read-only' : undefined;
  }

  private legacyAgentFilePath(name: string): string {
    return join(this.paths.getCommandsDir(), `agent-${name}.md`);
  }

  private legacySkillsDir(): string {
    return join(this.paths.getBaseDir(), 'skills');
  }

  /** Parse Codex TOML MCP config → canonical MCPServer[] */
  override parseMCPServers(content: string): MCPServer[] {
    try {
      const parsed = readToml<Record<string, unknown>>(content);
      const mcpServers = parsed.mcp_servers as Record<string, Record<string, unknown>> | undefined;
      if (!mcpServers) return [];

      const servers: MCPServer[] = [];
      for (const [name, cfg] of Object.entries(mcpServers)) {
        const transport: 'stdio' | 'http' = typeof cfg.command === 'string' ? 'stdio' : 'http';
        const server: MCPServer = { name, transport };

        if (transport === 'stdio') {
          server.command = cfg.command as string;
          if (Array.isArray(cfg.args)) {
            server.args = cfg.args as string[];
          }
          if (cfg.env && typeof cfg.env === 'object') {
            server.env = cfg.env as Record<string, string>;
          }
          if (Array.isArray(cfg.env_vars)) {
            server.envVars = cfg.env_vars
              .map(extractEnvVarName)
              .filter((entry): entry is string => Boolean(entry));
          } else if (server.env) {
            server.envVars = Object.keys(server.env);
          }
        } else {
          server.url = cfg.url as string;

          const headers: Record<string, string> = {};

          if (cfg.bearer_token_env_var && typeof cfg.bearer_token_env_var === 'string') {
            headers.Authorization = `Bearer \${${cfg.bearer_token_env_var}}`;
          }

          if (cfg.http_headers && typeof cfg.http_headers === 'object') {
            for (const [headerName, value] of Object.entries(cfg.http_headers as Record<string, unknown>)) {
              if (typeof value === 'string') {
                headers[headerName] = value;
              }
            }
          }

          if (cfg.env_http_headers && typeof cfg.env_http_headers === 'object') {
            for (const [headerName, envName] of Object.entries(cfg.env_http_headers as Record<string, unknown>)) {
              if (typeof envName === 'string') {
                headers[headerName] = `\${${envName}}`;
              }
            }
          }

          if (Object.keys(headers).length > 0) {
            server.headers = headers;
          }
        }

        if (cfg.enabled === false) {
          server.enabled = false;
        }

        servers.push(server);
      }
      return servers;
    } catch {
      return [];
    }
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

  /** Codex renders all MCP servers except target-disabled ones */
  override getRenderedServerNames(servers: MCPServer[]): string[] {
    return servers
      .filter((s) => !s.disabledFor?.includes('codex'))
      .map((s) => s.name);
  }

  renderMCPServers(servers: MCPServer[], existingContent?: string): string {
    const filtered = servers.filter((s) => !s.disabledFor?.includes('codex'));

    const mcp_servers: Record<string, unknown> = {};
    for (const server of filtered) {
      const cfg: Record<string, unknown> = {};

      if (server.transport === 'stdio') {
        cfg.command = server.command;
        if (server.args && server.args.length > 0) {
          cfg.args = server.args;
        }
        if (server.envVars && server.envVars.length > 0) {
          cfg.env_vars = server.envVars;
        }
        if (server.env && Object.keys(server.env).length > 0) {
          cfg.env = server.env;
        }
      } else {
        cfg.url = server.url;

        const http_headers: Record<string, string> = {};
        const env_http_headers: Record<string, string> = {};

        for (const [headerName, value] of Object.entries(server.headers ?? {})) {
          if (headerName === 'Authorization') {
            const bearerVar = extractBearerTokenVar(value);
            if (bearerVar) {
              cfg.bearer_token_env_var = bearerVar;
              continue;
            }
          }

          const envVar = extractEnvVarPlaceholder(value);
          if (envVar) {
            env_http_headers[headerName] = envVar;
          } else {
            http_headers[headerName] = value;
          }
        }

        if (Object.keys(http_headers).length > 0) {
          cfg.http_headers = http_headers;
        }
        if (Object.keys(env_http_headers).length > 0) {
          cfg.env_http_headers = env_http_headers;
        }
      }

      if (server.enabled === false) {
        cfg.enabled = false;
      }

      mcp_servers[server.name] = cfg;
    }

    let base: Record<string, unknown> = {};
    if (existingContent) {
      try {
        base = readToml<Record<string, unknown>>(existingContent);
      } catch {
        // Unparseable existing file — start fresh
      }
    }

    if (filtered.length === 0 && Object.keys(base).length === 0) return '';

    return writeToml({ ...base, mcp_servers });
  }
}
