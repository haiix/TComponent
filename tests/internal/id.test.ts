import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateId, registerId } from '../../src/internal/id';
import { resetWarnings } from '../../src/internal/console';

describe('generateId', () => {
  it('generates unique identifier strings', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe('string');
  });
});

describe('registerId', () => {
  beforeEach(() => {
    resetWarnings();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a new ID in the provided map', () => {
    const map: Record<string, string> = {};
    registerId(map, 'my-id', 'target-element');

    expect(map['my-id']).toBe('target-element');
  });

  it('keeps the first registered target and warns if a duplicate ID is found (first-wins)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const map: Record<string, string> = {};

    registerId(map, 'dup-id', 'first-target');
    registerId(map, 'dup-id', 'second-target'); // Should be ignored

    expect(map['dup-id']).toBe('first-target');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[TComponent] Duplicate id "dup-id" found in template. Only the first instance will be mapped.',
    );
  });
});
