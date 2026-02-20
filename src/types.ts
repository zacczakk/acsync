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
