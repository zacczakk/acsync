export interface ErrorContext {
  operation: string;
  path: string;
  cause: Error;
}

export interface ExclusionResult {
  excluded: boolean;
  reason?: string;
}

export interface SyncConfig {
  sync: {
    exclusions: string[];
    backupRetention: number;
  };
}

export type TargetName = 'claude-code' | 'opencode' | 'gemini' | 'codex';

export interface SupportFile {
  relativePath: string;
  content: string;
}

// Canonical interchange model (ported from vsync BaseItem)
export interface CanonicalItem {
  name: string;
  content: string;
  metadata: Record<string, unknown>;
  hash?: string;
  supportFiles?: SupportFile[];
}

// Canonical MCP server
export interface MCPServer {
  name: string;
  description?: string;
  transport: 'stdio' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  envVars?: string[];
  disabledFor?: TargetName[];
}

// Rendered output from an adapter
export interface RenderedFile {
  relativePath: string;
  content: string;
}

// Per-target capability matrix
export interface AdapterCapabilities {
  commands: boolean;
  agents: boolean;
  mcp: boolean;
  instructions: boolean;
  skills: boolean;
}
