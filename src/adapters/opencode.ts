import { BaseAdapter } from './base';
import { stringifyFrontmatter } from '../formats/markdown';
import { modifyJsonc, readJsonc } from '../formats/jsonc';
import { EnvVarTransformer } from '../secrets/env-var-transformer';
import type {
  CanonicalItem,
  CanonicalSettings,
  MCPServer,
  RenderedFile,
  AdapterCapabilities,
} from '../types';

export class OpenCodeAdapter extends BaseAdapter {
  constructor() {
    super('opencode', 'OpenCode');
  }

  getCapabilities(): AdapterCapabilities {
    return { commands: true, agents: true, mcp: true, instructions: true, skills: true, settings: true };
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

  /** OpenCode uses mcp key (not mcpServers) */
  override parseExistingMCPServerNames(content: string): string[] {
    try {
      const parsed = readJsonc<Record<string, unknown>>(content);
      const mcp = parsed.mcp as Record<string, unknown> | undefined;
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
      .filter((s) => !s.disabledFor?.includes('opencode'))
      .map((s) => s.name);
  }

  /** Parse OpenCode JSONC MCP config → canonical MCPServer[] */
  override parseMCPServers(content: string): MCPServer[] {
    try {
      const parsed = readJsonc<Record<string, unknown>>(content);
      const mcp = parsed.mcp as Record<string, Record<string, unknown>> | undefined;
      if (!mcp) return [];

      const servers: MCPServer[] = [];
      for (const [name, cfg] of Object.entries(mcp)) {
        const type = cfg.type as string | undefined;
        const transport: 'stdio' | 'http' = type === 'remote' ? 'http' : 'stdio';
        const server: MCPServer = { name, transport };

        if (transport === 'stdio') {
          // OpenCode: command is [binary, ...args] array
          const cmdArr = cfg.command as string[] | undefined;
          if (cmdArr && cmdArr.length > 0) {
            server.command = cmdArr[0];
            if (cmdArr.length > 1) server.args = cmdArr.slice(1);
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
        }

        // OpenCode natively supports enabled
        if (cfg.enabled === false) server.enabled = false;

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
  override renderSettings(settings: CanonicalSettings, existingContent?: string): string {
    let text = existingContent ?? '{}';
    const existing = existingContent ? readJsonc<Record<string, unknown>>(existingContent) : {};

    for (const [key, value] of Object.entries(settings.keys)) {
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
    // Filter out servers disabled for this target (but keep enabled: false — render as disabled)
    const filtered = servers.filter((s) => !s.disabledFor?.includes('opencode'));

    let text = existingContent ?? '{}';

    // Ensure mcp object exists
    text = modifyJsonc(text, ['mcp'], {}) as string;

    for (const server of filtered) {
      const cfg: Record<string, unknown> = {
        type: server.transport === 'stdio' ? 'local' : 'remote',
      };

      if (server.transport === 'stdio') {
        cfg.command = [server.command, ...(server.args ?? [])];
      } else {
        cfg.url = server.url;
      }

      if (server.env && Object.keys(server.env).length > 0) {
        cfg.environment = EnvVarTransformer.toOpenCode(server.env) as Record<string, string>;
      }

      // OpenCode natively supports enabled: false
      cfg.enabled = server.enabled !== false;

      text = modifyJsonc(text, ['mcp', server.name], cfg) as string;
    }

    return text;
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Deep-merge two objects: canonical wins on conflict, user extras preserved.
 * Recurses into nested plain objects; arrays and primitives use canonical value.
 */
function deepMergeObjects(
  existing: Record<string, unknown>,
  canonical: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...existing };
  for (const [key, canonicalValue] of Object.entries(canonical)) {
    if (isPlainObject(canonicalValue) && isPlainObject(result[key])) {
      result[key] = deepMergeObjects(result[key] as Record<string, unknown>, canonicalValue);
    } else {
      result[key] = canonicalValue;
    }
  }
  return result;
}
