import { describe, it, expect } from 'bun:test';
import { injectSecrets, redactSecrets } from '../injector';

describe('injectSecrets', () => {
  it('replaces known placeholders', () => {
    const { result, warnings } = injectSecrets('Hello ${NAME}!', { NAME: 'World' });
    expect(result).toBe('Hello World!');
    expect(warnings).toHaveLength(0);
  });

  it('leaves unresolved placeholders intact and warns', () => {
    const { result, warnings } = injectSecrets('Token: ${MISSING}', {});
    expect(result).toBe('Token: ${MISSING}');
    expect(warnings).toContain('Unresolved secret: MISSING');
  });

  it('handles partial injection — some resolved, some not', () => {
    const { result, warnings } = injectSecrets('${A} and ${B}', { A: 'alpha' });
    expect(result).toBe('alpha and ${B}');
    expect(warnings).toContain('Unresolved secret: B');
  });

  it('warns once per unique placeholder even if it appears multiple times', () => {
    const { result, warnings } = injectSecrets('${X} ${X}', {});
    expect(result).toBe('${X} ${X}');
    // Two occurrences → two warnings (one per match, not deduplicated at this layer)
    expect(warnings.filter((w) => w.includes('X'))).toHaveLength(2);
  });

  it('returns content unchanged when secrets is empty and no placeholders', () => {
    const { result, warnings } = injectSecrets('no placeholders here', {});
    expect(result).toBe('no placeholders here');
    expect(warnings).toHaveLength(0);
  });
});

describe('redactSecrets', () => {
  it('replaces secret values with ****', () => {
    const result = redactSecrets('token=abc123', { TOKEN: 'abc123' });
    expect(result).toBe('token=****');
  });

  it('handles multiple different secrets', () => {
    const result = redactSecrets('a=foo b=bar', { A: 'foo', B: 'bar' });
    expect(result).toBe('a=**** b=****');
  });

  it('sorts by length to avoid partial replacement', () => {
    // 'secret' is a prefix of 'secretkey' — longer value should be replaced first
    const result = redactSecrets('value=secretkey', { SHORT: 'secret', LONG: 'secretkey' });
    expect(result).toBe('value=****');
  });

  it('returns unchanged content when secrets is empty', () => {
    const result = redactSecrets('no secrets here', {});
    expect(result).toBe('no secrets here');
  });

  it('handles empty string secret values (skips them)', () => {
    const result = redactSecrets('hello world', { EMPTY: '' });
    expect(result).toBe('hello world');
  });

  it('escapes regex special chars in secret values', () => {
    const result = redactSecrets('price is $5.00', { PRICE: '$5.00' });
    expect(result).toBe('price is ****');
  });
});
