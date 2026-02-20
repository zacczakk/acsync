import os from 'node:os';
import { AdapterPathResolver } from './path-resolver';
import type {
  TargetName,
  CanonicalItem,
  MCPServer,
  RenderedFile,
  AdapterCapabilities,
} from '../types';

export interface ToolAdapter {
  readonly target: TargetName;
  readonly displayName: string;

  getCapabilities(): AdapterCapabilities;

  /** Render a single command item → path + content */
  renderCommand(item: CanonicalItem): RenderedFile;

  /** Render a single agent item → path + content */
  renderAgent(item: CanonicalItem): RenderedFile;

  /** Render all MCP servers → complete settings file content */
  renderMCPServers(servers: MCPServer[], existingContent?: string): string;

  /** Return names of servers that will be rendered (for diff display) */
  getRenderedServerNames(servers: MCPServer[]): string[];

  /** Render instructions by concatenating base + addendum */
  renderInstructions(baseMd: string, addendumMd: string): string;

  /** Expose path resolver for orchestrator use */
  getPaths(): AdapterPathResolver;
}

export abstract class BaseAdapter implements ToolAdapter {
  readonly target: TargetName;
  readonly displayName: string;
  protected readonly paths: AdapterPathResolver;

  constructor(target: TargetName, displayName: string) {
    this.target = target;
    this.displayName = displayName;
    this.paths = new AdapterPathResolver(target);
  }

  abstract getCapabilities(): AdapterCapabilities;
  abstract renderCommand(item: CanonicalItem): RenderedFile;
  abstract renderAgent(item: CanonicalItem): RenderedFile;
  abstract renderMCPServers(servers: MCPServer[], existingContent?: string): string;

  /** Default: servers not in disabledFor and not globally disabled */
  getRenderedServerNames(servers: MCPServer[]): string[] {
    return servers
      .filter((s) => !s.disabledFor?.includes(this.target) && s.enabled !== false)
      .map((s) => s.name);
  }

  /** Default: concatenate base + addendum with double-newline separator */
  renderInstructions(baseMd: string, addendumMd: string): string {
    return baseMd + '\n\n' + addendumMd + '\n';
  }

  /** Expose path resolver for orchestrator use */
  getPaths(): AdapterPathResolver {
    return this.paths;
  }

  /** Expand ~ in content strings */
  protected expandPaths(content: string): string {
    return content.replace(/~\//g, os.homedir() + '/');
  }
}
