/**
 * Shared merge utilities for settings adapters.
 *
 * - isPlainObject / deepMergeObjects — generic deep-merge (canonical wins)
 * - mergeHooks / extractManagedHooks — hook-aware per-event merge with _managed markers
 */

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Deep-merge two objects: canonical wins on conflict, user extras preserved.
 * Recurses into nested plain objects; arrays and primitives use canonical value.
 */
export function deepMergeObjects(
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

/** A single hook group entry (Claude Code hooks schema) */
interface HookGroup {
  _managed?: string;
  hooks: Array<{ type: string; command: string }>;
  [key: string]: unknown;
}

/** The full hooks object: event key → array of hook groups */
type HooksObject = Record<string, HookGroup[]>;

/**
 * Merge hooks per-event-key: preserve user groups, replace managed groups.
 *
 * For each event key in the union of existing and canonical:
 * - User groups (no `_managed` or different `_managed`) are kept as-is
 * - Canonical groups (`_managed: "acsync"`) replace any prior acsync groups
 */
export function mergeHooks(existing: HooksObject, canonical: HooksObject): HooksObject {
  const allKeys = new Set([...Object.keys(existing), ...Object.keys(canonical)]);
  const result: HooksObject = {};

  for (const eventKey of allKeys) {
    const existingGroups = existing[eventKey] ?? [];
    const canonicalGroups = canonical[eventKey] ?? [];

    // Keep user groups (not managed by acsync)
    const userGroups = existingGroups.filter((g) => g._managed !== 'acsync');

    // Append canonical groups (all have _managed: "acsync")
    result[eventKey] = [...userGroups, ...canonicalGroups];
  }

  return result;
}

/**
 * Extract only acsync-managed hook groups from a hooks object.
 * Used for drift detection — we only compare our managed groups.
 */
export function extractManagedHooks(hooks: HooksObject): HooksObject {
  const result: HooksObject = {};
  for (const [eventKey, groups] of Object.entries(hooks)) {
    const managed = groups.filter((g) => g._managed === 'acsync');
    if (managed.length > 0) {
      result[eventKey] = managed;
    }
  }
  return result;
}
