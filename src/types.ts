export interface ErrorContext {
  operation: string;
  path: string;
  cause: Error;
}

// Config item types synced by acsync
export type ItemType = 'command' | 'agent' | 'mcp' | 'instruction' | 'skill';

// Operation types (no 'delete' — we never delete non-canonical items per EXCL-02)
export type OperationType = 'create' | 'update' | 'skip';

export interface TargetStatus {
  hash: string;
  lastSynced: string; // ISO 8601
}

export interface ManifestItem {
  type: ItemType;
  name: string;
  sourceHash: string;
  lastSynced: string;
  targets: Partial<Record<TargetName, TargetStatus>>;
}

export interface Manifest {
  version: '1.0.0';
  lastSynced: string;
  items: Record<string, ManifestItem>; // key = "type/name"
}

export interface Operation {
  type: OperationType;
  itemType: ItemType;
  name: string;
  target: TargetName;
  reason: string;
  oldHash?: string;
  newHash?: string;
  sourcePath?: string; // canonical source file
  targetPath?: string; // rendered target file
}

export interface MCPWarning {
  serverNames: string[];
  action: 'remove' | 'orphan'; // remove = overwritten on push; orphan = left behind
}

export interface DiffResult {
  target: TargetName;
  operations: Operation[]; // all ops for this target (create + update + skip)
  summary: { create: number; update: number; skip: number };
  mcpWarning?: MCPWarning;
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
  enabled?: boolean;       // false = render but mark disabled in target config
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
