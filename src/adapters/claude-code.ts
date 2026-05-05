import { BaseAdapter } from './base';
import { stringifyFrontmatter, parseFrontmatter } from '../formats/markdown';
import { readJson, writeJson } from '../formats/json';
import { isPlainObject, mergeHooks, extractManagedHooks } from './merge';
import type {
  CanonicalItem,
  CanonicalSettings,
  MCPServer,
  RenderedFile,
  AdapterCapabilities,
} from '../types';

export class ClaudeCodeAdapter extends BaseAdapter {
  constructor(homeDir?: string) {
    super('claude-code', 'Claude Code', homeDir);
  }

  getCapabilities(): AdapterCapabilities {
    return { commands: true, agents: true, mcp: true, instructions: true, skills: true, settings: true, plugins: false, hooks: false };
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
    const content = stringifyFrontmatter(item.content, this.normalizeClaudeAgentMetadata(item));
    return {
      relativePath: this.paths.getAgentFilePath(item.name),
      content,
    };
  }

  private static readonly REASONING_EFFORT_MODEL_MAP: Record<string, string> = {
    high: 'claude-opus-4-6',
    medium: 'sonnet',
    low: 'haiku',
  };

  private normalizeClaudeAgentMetadata(item: CanonicalItem): Record<string, unknown> {
    const src = item.metadata;
    const metadata: Record<string, unknown> = {};

    metadata.name = item.name;
    if (src.description) metadata.description = src.description;

    const effort = typeof src.reasoningEffort === 'string' ? src.reasoningEffort : undefined;
    const mappedModel = effort ? ClaudeCodeAdapter.REASONING_EFFORT_MODEL_MAP[effort] : undefined;
    metadata.model = mappedModel ?? src.model ?? 'sonnet';

    const allowedTools = this.deriveAllowedTools(src);
    if (allowedTools) metadata.tools = allowedTools;

    return metadata;
  }

  /** Reverse-map Claude Code agent format back to canonical form */
  override parseAgent(name: string, content: string): CanonicalItem {
    const { data, content: body } = parseFrontmatter(content);

    // Drop model (derived at render time) and rename tools → allowed-tools
    const { model: _model, tools, ...rest } = data as Record<string, unknown>;
    const canonical: Record<string, unknown> = { ...rest };
    if (tools) canonical['allowed-tools'] = tools;

    return { name, content: body, metadata: canonical };
  }

  private static readonly HOOKS_KEY = 'hooks';

  /** Hook-aware settings merge: per-event merge for hooks, wholesale replace for everything else */
  override renderSettings(settings: CanonicalSettings, existingContent?: string): string {
    const base: Record<string, unknown> = existingContent
      ? readJson<Record<string, unknown>>(existingContent)
      : {};
    for (const [key, value] of Object.entries(settings.keys)) {
      if (key === ClaudeCodeAdapter.HOOKS_KEY && isPlainObject(value) && isPlainObject(base[key])) {
        base[key] = mergeHooks(
          base[key] as Record<string, Array<Record<string, unknown>>>,
          value as Record<string, Array<Record<string, unknown>>>,
        );
      } else {
        base[key] = value;
      }
    }
    return writeJson(base);
  }

  /** Extract only managed hook groups for drift comparison */
  override extractSettingsKeys(canonicalKeys: string[], targetContent: string): string {
    const parsed = readJson<Record<string, unknown>>(targetContent);
    const extracted: Record<string, unknown> = {};
    for (const key of [...canonicalKeys].sort()) {
      if (key in parsed) {
        extracted[key] =
          key === ClaudeCodeAdapter.HOOKS_KEY && isPlainObject(parsed[key])
            ? extractManagedHooks(parsed[key] as Record<string, Array<Record<string, unknown>>>)
            : parsed[key];
      }
    }
    return JSON.stringify(extracted, null, 2) + '\n';
  }

  override getRenderedServerNames(servers: MCPServer[]): string[] {
    return servers
      .filter((s) => !s.disabledFor?.includes('claude-code'))
      .map((s) => s.name);
  }

  override renderMCPServers(servers: MCPServer[], existingContent?: string): string {
    const filtered = servers.filter((s) => !s.disabledFor?.includes('claude-code'));

    const mcpServers: Record<string, unknown> = {};
    for (const server of filtered) {
      const targetOptions = server.targetOptions?.['claude-code'] ?? {};
      const targetType = typeof targetOptions.type === 'string' ? targetOptions.type : undefined;
      const targetDisabled = targetOptions.disabled === true;

      if (server.transport === 'stdio') {
        const cfg: Record<string, unknown> = {};
        if (targetType) cfg.type = targetType;
        cfg.command = server.command;
        cfg.args = server.args ?? [];
        if (server.env && Object.keys(server.env).length > 0) cfg.env = server.env;
        if (server.enabled === false && !targetDisabled) cfg.enabled = false;
        for (const [key, value] of Object.entries(targetOptions)) {
          if (key === 'type' || key === 'disabled') continue;
          cfg[key] = value;
        }
        if (targetDisabled) cfg.disabled = true;
        mcpServers[server.name] = cfg;
      } else {
        const cfg: Record<string, unknown> = { type: 'http', url: server.url };
        if (server.headers && Object.keys(server.headers).length > 0) cfg.headers = server.headers;
        if (server.enabled === false && !targetDisabled) cfg.enabled = false;
        for (const [key, value] of Object.entries(targetOptions)) {
          if (key === 'type' || key === 'disabled') continue;
          cfg[key] = value;
        }
        if (targetDisabled) cfg.disabled = true;
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
