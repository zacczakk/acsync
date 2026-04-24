import path from 'node:path';
import type { TargetName } from '../types';

export type CavemanTarget = Extract<TargetName, 'claude-code' | 'codex' | 'opencode'>;

export function getCavemanStatePath(target: CavemanTarget, homeDir: string): string {
  switch (target) {
    case 'claude-code':
      return path.join(homeDir, '.claude', '.caveman-active');
    case 'codex':
      return path.join(homeDir, '.codex', '.caveman-active');
    case 'opencode':
      return path.join(homeDir, '.config', 'opencode', '.caveman-active');
  }
}
