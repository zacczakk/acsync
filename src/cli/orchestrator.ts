/**
 * Re-export facade — preserves backward compatibility for existing imports.
 * Real implementations live in canonical.ts, sync-check.ts, sync-push.ts, sync-pull.ts.
 */
export {
  ALL_TARGETS,
  createAdapter,
  hashContent,
  hashRendered,
  hashTargetFile,
  readCanonicalCommands,
  readCanonicalAgents,
  readCanonicalMCPServers,
  readCanonicalInstructions,
  readCanonicalSkills,
} from './canonical';
export type { SyncOptions } from './canonical';

export { runCheck } from './sync-check';
export type { OrchestratorCheckResult } from './sync-check';

export { runPush } from './sync-push';
export type { OrchestratorPushResult } from './sync-push';

export { runPull, runPullAll } from './sync-pull';
export type { PullOptions, PullItem, OrchestratorPullResult, PullAllOptions } from './sync-pull';
