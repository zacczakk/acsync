import { BaseAdapter } from './base';
import { stringifyFrontmatter } from '../formats/markdown';
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
    return { commands: true, agents: true, mcp: true, instructions: true, skills: true, settings: true, plugins: false };
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
    // All frontmatter keys pass through verbatim
    // Body is verbatim
    const content = stringifyFrontmatter(item.content, item.metadata);
    return {
      relativePath: this.paths.getAgentFilePath(item.name),
      content,
    };
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

  renderMCPServers(servers: MCPServer[], existingContent?: string): string {
    // Filter out servers disabled for this target OR globally disabled
    // (Claude Code has no native disabled mechanism)
    const filtered = servers.filter(
      (s) => !s.disabledFor?.includes('claude-code') && s.enabled !== false,
    );

    const mcpServers: Record<string, unknown> = {};
    for (const server of filtered) {
      if (server.transport === 'stdio') {
        const cfg: Record<string, unknown> = { command: server.command, args: server.args ?? [] };
        if (server.env && Object.keys(server.env).length > 0) cfg.env = server.env;
        mcpServers[server.name] = cfg;
      } else {
        const cfg: Record<string, unknown> = { type: 'http', url: server.url };
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
