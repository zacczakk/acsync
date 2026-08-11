import { describe, expect, test } from 'bun:test';
import { mapTargets, validateTargets } from '../cli-helpers';

describe('OpenCode target selection', () => {
  test('accepts the explicit opencode2 target', () => {
    expect(() => validateTargets(['opencode2'])).not.toThrow();
    expect(mapTargets(['opencode2'])).toEqual(['opencode2']);
  });

  test('rejects selecting both OpenCode identities', () => {
    expect(() => validateTargets(['opencode', 'opencode2'])).toThrow();
  });
});
