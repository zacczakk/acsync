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

  /** OpenCode uses JSONC — override to preserve comments and $schema */
  override renderSettings(settings: CanonicalSettings, existingContent?: string): string {
    let text = existingContent ?? '{}';
    for (const [key, value] of Object.entries(settings.keys)) {
      text = modifyJsonc(text, [key], value) as string;
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

  renderMCPServers(servers: MCPServer[], existingContent?: string): string {
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
