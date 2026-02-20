import type { TargetName, ItemType } from '../types';

const VALID_TARGETS = ['claude', 'gemini', 'codex', 'opencode'] as const;
const VALID_TYPES = ['commands', 'agents', 'mcps', 'instructions', 'skills'] as const;

type UserTarget = (typeof VALID_TARGETS)[number];
type UserType = (typeof VALID_TYPES)[number];

/** Commander repeatable option collector */
export function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

/** Validate user-facing target names */
export function validateTargets(targets: string[]): void {
  for (const t of targets) {
    if (!VALID_TARGETS.includes(t as UserTarget)) {
      throw new Error(
        `Invalid target: "${t}". Valid targets: ${VALID_TARGETS.join(', ')}`,
      );
    }
  }
}

/** Validate user-facing type names */
export function validateTypes(types: string[]): void {
  for (const t of types) {
    if (!VALID_TYPES.includes(t as UserType)) {
      throw new Error(
        `Invalid type: "${t}". Valid types: ${VALID_TYPES.join(', ')}`,
      );
    }
  }
}

/**
 * Map user-facing target names to internal TargetName.
 * 'claude' → 'claude-code', others pass through.
 * If empty, returns undefined (all targets).
 */
export function mapTargets(targets: string[]): TargetName[] | undefined {
  if (targets.length === 0) return undefined;
  return targets.map((t): TargetName => {
    if (t === 'claude') return 'claude-code';
    return t as TargetName;
  });
}

/**
 * Map user-facing plural type names to internal ItemType (singular).
 * 'commands' → 'command', 'agents' → 'agent', 'mcps' → 'mcp',
 * 'instructions' → 'instruction', 'skills' → 'skill'.
 * If empty, returns undefined (all types).
 */
export function mapTypes(types: string[]): ItemType[] | undefined {
  if (types.length === 0) return undefined;
  return types.map((t): ItemType => {
    switch (t) {
      case 'commands': return 'command';
      case 'agents': return 'agent';
      case 'mcps': return 'mcp';
      case 'instructions': return 'instruction';
      case 'skills': return 'skill';
      default: return t as ItemType;
    }
  });
}
