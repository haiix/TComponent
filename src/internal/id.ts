import { warnOnce } from './console';

/**
 * List of attributes that reference elements by their ID.
 */
export const ID_REF_ATTRIBUTES = new Set([
  'for',
  'aria-labelledby',
  'aria-describedby',
  'aria-controls',
  'aria-owns',
  'aria-activedescendant',
  'aria-flowto',
  'aria-errormessage',
  'aria-details',
  'headers',
  'list',
]);

/**
 * Generates an identifier string.
 *
 * If `crypto.randomUUID` is available, a UUID is returned.
 * Otherwise, a pseudo-random ID is generated using `Math.random`,
 * prefixed with 'uid-'.
 *
 * Note:
 * - The fallback ID is not guaranteed to be globally unique.
 *
 * @returns An identifier string (UUID or prefixed pseudo-random ID).
 */
export function generateId(): string {
  /* eslint-disable @typescript-eslint/no-unnecessary-condition */
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `uid-${Math.random().toString(36).slice(2, 11)}`;
  /* eslint-enable @typescript-eslint/no-unnecessary-condition */
}

/**
 * Registers a target in the given `idMap` using its ID.
 *
 * Uses a "first-wins" strategy: if the ID already exists, the new entry is ignored
 * and a warning is logged (once). This behavior is similar to how DOM APIs
 * typically resolve duplicate IDs (e.g., returning the first match).
 *
 * @param idMap - A mutable map from IDs to their corresponding targets.
 * @param id - The ID used as the lookup key.
 * @param target - The target to associate with the given ID.
 */
export function registerId<T>(
  idMap: Record<string, T>,
  id: string,
  target: T,
): void {
  if (id in idMap) {
    warnOnce(
      `duplicate-id:${id}`,
      `Duplicate id "${id}" found in template. Only the first instance will be mapped.`,
    );
  } else {
    idMap[id] = target;
  }
}
