import { BaseAdapter } from './base';
import { stringifyFrontmatter } from '../formats/markdown';
import { modifyJsonc, readJsonc } from '../formats/jsonc';
import { EnvVarTransformer } from '../secrets/env-var-transformer';
import { isPlainObject, deepMergeObjects } from './merge';
import { applyOpenCodeAgentVariants, configureOpenCodeV2Plugins, mergeOpenCodeSettings, preserveOpenCodeAgentVariants, renderOpenCodeAgent, renderOpenCodeAgentVariants, renderOpenCodeMcp, renderOpenCodeSettings, type OpenCodeVersion } from '../opencode/version-renderer';
import type {
  CanonicalItem,
  CanonicalSettings,
  MCPServer,
  RenderedFile,
  AdapterCapabilities,
} from '../types';

export class OpenCodeAdapter extends BaseAdapter {
  constructor(homeDir?: string, private readonly version: OpenCodeVersion = 'v1', target: 'opencode' | 'opencode2' = 'opencode') {
    super(target, 'OpenCode', homeDir);
  }

  getCapabilities(): AdapterCapabilities {
    return { commands: true, agents: true, mcp: true, instructions: true, skills: true, settings: true, agentVariantsInSettings: this.version === 'v2', plugins: this.version === 'v1', hooks: false };
  }

  private get mcpTarget(): 'opencode' | 'opencode2' {
    return this.version === 'v2' ? 'opencode2' : this.target as 'opencode' | 'opencode2';
  }

  /** Keys that only exist in the canonical format — strip before rendering */
  private static readonly CANONICAL_ONLY_KEYS = new Set(['allowed-tools', 'argument-hint', 'name', 'targets']);

  renderCommand(item: CanonicalItem): RenderedFile {
    // Pass through all frontmatter except canonical-only keys
    const metadata: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item.metadata)) {
      if (!OpenCodeAdapter.CANONICAL_ONLY_KEYS.has(key)) metadata[key] = value;
    }

    const content = stringifyFrontmatter(item.content, metadata);
    return {
      relativePath: this.paths.getCommandFilePath(item.name),
      content,
    };
  }

  renderAgent(item: CanonicalItem): RenderedFile {
    // Pass through all frontmatter except canonical-only keys, inject mode: subagent
    const metadata: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item.metadata)) {
      if (!OpenCodeAdapter.CANONICAL_ONLY_KEYS.has(key)) metadata[key] = value;
    }
    metadata.mode = 'subagent';
    if (this.version === 'v2') {
      const rendered = renderOpenCodeAgent({ ...metadata, _agentName: item.name }, 'v2');
      delete rendered._modelVariant;
      return { relativePath: this.paths.getAgentFilePath(item.name), content: stringifyFrontmatter(item.content, rendered) };
    }

    const content = stringifyFrontmatter(item.content, metadata);
    return {
      relativePath: this.paths.getAgentFilePath(item.name),
      content,
    };
  }

  /** OpenCode uses mcp key (not mcpServers) */
  override parseExistingMCPServerNames(content: string): string[] {
    try {
      const parsed = readJsonc<Record<string, unknown>>(content);
      const mcp = parsed.mcp as Record<string, unknown> | undefined;
      if (this.version === 'v2') {
        const servers = mcp?.servers as Record<string, unknown> | undefined;
        return servers ? Object.keys(servers) : [];
      }
      return mcp ? Object.keys(mcp) : [];
    } catch {
      return [];
    }
  }

  /** OpenCode resets mcp object then re-adds canonical — non-canonical removed */
  override removesNonCanonicalOnPush(): boolean {
    return true;
  }

  /** OpenCode renders enabled: false servers (with disabled flag) */
  override getRenderedServerNames(servers: MCPServer[]): string[] {
    return servers
      .filter((s) => !s.disabledFor?.includes(this.mcpTarget))
      .map((s) => s.name);
  }

  /** Parse OpenCode JSONC MCP config → canonical MCPServer[] */
  override parseMCPServers(content: string): MCPServer[] {
    try {
      const parsed = readJsonc<Record<string, unknown>>(content);
      const mcp = parsed.mcp as Record<string, Record<string, unknown>> | undefined;
      const entries = this.version === 'v2'
        ? mcp?.servers as Record<string, Record<string, unknown>> | undefined
        : mcp;
      if (!entries) return [];

      const servers: MCPServer[] = [];
      for (const [name, cfg] of Object.entries(entries)) {
        const type = cfg.type as string | undefined;
        const transport: 'stdio' | 'http' = type === 'remote' ? 'http' : 'stdio';
        const server: MCPServer = { name, transport };

        if (transport === 'stdio') {
          // OpenCode: command is [binary, ...args] array
          const cmdArr = cfg.command as string[] | undefined;
          if (cmdArr && cmdArr.length > 0) {
            server.command = cmdArr[0];
            server.args = cmdArr.slice(1);
          }
          // OpenCode: environment uses {env:VAR} syntax
          if (cfg.environment && typeof cfg.environment === 'object') {
            const rawEnv = cfg.environment as Record<string, string>;
            // Convert {env:VAR} → ${VAR} (claude-code canonical format)
            server.env = EnvVarTransformer.fromOpenCode(rawEnv) as Record<string, string>;
            server.envVars = Object.keys(rawEnv);
          }
        } else {
          server.url = cfg.url as string;
          if (cfg.headers && typeof cfg.headers === 'object') {
            server.headers = EnvVarTransformer.fromOpenCode(cfg.headers) as Record<string, string>;
          }
        }

        if (this.version === 'v2' ? cfg.disabled === true : cfg.enabled === false) server.enabled = false;

        const targetOptions: Record<string, unknown> = {};
        for (const key of ['oauth', 'codemode', 'timeout']) {
          if (key in cfg) targetOptions[key] = cfg[key];
        }
        if (Object.keys(targetOptions).length > 0) {
          server.targetOptions = { [this.mcpTarget]: targetOptions };
        }

        servers.push(server);
      }
      return servers;
    } catch {
      return [];
    }
  }

  /** Keys that use deep-merge (canonical wins on conflict, user extras preserved) */
  private static readonly DEEP_MERGE_KEYS = new Set(['permission']);

  /** OpenCode uses JSONC — override to preserve comments and $schema */
  override renderSettings(settings: CanonicalSettings, existingContent?: string, agents: CanonicalItem[] = []): string {
    if (this.version === 'v2') {
      const existing = existingContent ? readJsonc<Record<string, unknown>>(existingContent) : {};
      let rendered = renderOpenCodeSettings(settings.keys, 'v2');
      rendered = applyOpenCodeAgentVariants(rendered, renderOpenCodeAgentVariants(agents));
      configureOpenCodeV2Plugins(rendered, existing);
      preserveOpenCodeAgentVariants(rendered, existing);
      return JSON.stringify(mergeOpenCodeSettings(existing, rendered, 'v2'), null, 2) + '\n';
    }
    let text = existingContent ?? '{}';
    const existing = existingContent ? readJsonc<Record<string, unknown>>(existingContent) : {};
    const renderedSettings = renderOpenCodeSettings(settings.keys, 'v1');

    for (const [key, value] of Object.entries(renderedSettings)) {
      if (OpenCodeAdapter.DEEP_MERGE_KEYS.has(key) && isPlainObject(value) && isPlainObject(existing[key])) {
        // Deep-merge: canonical wins on conflict, user extras preserved
        const merged = deepMergeObjects(existing[key] as Record<string, unknown>, value as Record<string, unknown>);
        text = modifyJsonc(text, [key], merged) as string;
      } else {
        // Wholesale replace
        text = modifyJsonc(text, [key], value) as string;
      }
    }
    return text;
  }

  /** OpenCode uses JSONC — override to parse with comment support */
  override extractSettingsKeys(canonicalKeys: string[], targetContent: string): string {
    const parsed = readJsonc<Record<string, unknown>>(targetContent);
    const extracted: Record<string, unknown> = {};
    for (const key of [...canonicalKeys].sort()) {
      if (key in parsed) {
        extracted[key] = parsed[key];
      }
    }
    return JSON.stringify(extracted, null, 2) + '\n';
  }

  override renderMCPServers(servers: MCPServer[], existingContent?: string): string {
    if (this.version === 'v2') {
      const existing = existingContent ? readJsonc<Record<string, unknown>>(existingContent) : {};
      return JSON.stringify({ ...existing, mcp: renderOpenCodeMcp(servers, 'v2', this.mcpTarget) }, null, 2) + '\n';
    }
    // Filter out servers disabled for this target (but keep enabled: false — render as disabled)
    const filtered = servers.filter((s) => !s.disabledFor?.includes('opencode'));

    let text = existingContent ?? '{}';

    // Ensure mcp object exists
    text = modifyJsonc(text, ['mcp'], {}) as string;

    for (const server of filtered) {
      const cfg: Record<string, unknown> = {
        type: server.transport === 'stdio' ? 'local' : 'remote',
      };
      const targetOptions = server.targetOptions?.['opencode'] ?? {};

      if (server.transport === 'stdio') {
        cfg.command = [server.command, ...(server.args ?? [])];
      } else {
        cfg.url = server.url;
      }

      if (server.env && Object.keys(server.env).length > 0) {
        cfg.environment = EnvVarTransformer.toOpenCode(server.env) as Record<string, string>;
      }
      if (server.headers && Object.keys(server.headers).length > 0) {
        cfg.headers = EnvVarTransformer.toOpenCode(server.headers) as Record<string, string>;
      }

      // OpenCode natively supports enabled: false
      cfg.enabled = server.enabled !== false;
      Object.assign(cfg, targetOptions);

      text = modifyJsonc(text, ['mcp', server.name], cfg) as string;
    }

    return text;
  }
}
