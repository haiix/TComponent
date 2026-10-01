import { warnOnce } from './messages';
import { SVG_NAMESPACE_URI } from './dom';

/**
 * List of attributes that reference elements by their ID.
 */
export const ID_REF_ATTRIBUTES = new Set([
  'for',
  'form',
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

const FRAGMENT_REF_ATTRIBUTES = new Set(['href', 'xlink:href']);
const SVG_URL_REF_ATTRIBUTES = new Set([
  'fill',
  'stroke',
  'filter',
  'clip-path',
  'mask',
  'marker',
  'marker-start',
  'marker-mid',
  'marker-end',
]);
const LOCAL_FRAGMENT_PATTERN = /^(\s*#)([^\s]+)(\s*)$/u;
const LOCAL_SVG_URL_PATTERN = /\b(url\(\s*(["']?)#)([^"'()\s]+)(\2\s*\))/giu;

/**
 * Checks whether an attribute supports ID references on the receiving element.
 *
 * @param name - The attribute name.
 * @param element - The receiving DOM element.
 * @returns Whether the attribute supports ID resolution.
 */
export function isIdReferenceAttribute(
  name: string,
  element: Element,
): boolean {
  return (
    ID_REF_ATTRIBUTES.has(name) ||
    FRAGMENT_REF_ATTRIBUTES.has(name) ||
    (element.namespaceURI === SVG_NAMESPACE_URI &&
      SVG_URL_REF_ATTRIBUTES.has(name))
  );
}

/**
 * Checks whether an attribute value needs ID resolution.
 *
 * @param name - The attribute name.
 * @param value - The original attribute value.
 * @param element - The receiving DOM element.
 * @returns Whether an ID list or local fragment needs deferred resolution.
 */
export function hasIdReference(
  name: string,
  value: string,
  element: Element,
): boolean {
  if (!isIdReferenceAttribute(name, element)) return false;
  if (ID_REF_ATTRIBUTES.has(name)) return true;
  return FRAGMENT_REF_ATTRIBUTES.has(name)
    ? LOCAL_FRAGMENT_PATTERN.test(value)
    : value.search(LOCAL_SVG_URL_PATTERN) !== -1;
}

/**
 * Resolves ID lists, local fragments, or local SVG URL references.
 * External URLs and unresolved fragments retain their original spelling.
 *
 * @param name - The attribute name.
 * @param value - The original attribute value.
 * @param resolveId - Resolves a template ID, returning the original if unknown.
 * @returns The attribute value with resolved IDs.
 */
export function resolveIdReferenceValue(
  name: string,
  value: string,
  resolveId: (id: string) => string,
): string {
  if (ID_REF_ATTRIBUTES.has(name)) {
    return value.trim().split(/\s+/u).map(resolveId).join(' ');
  }
  if (FRAGMENT_REF_ATTRIBUTES.has(name)) {
    return value.replace(
      LOCAL_FRAGMENT_PATTERN,
      (_match, prefix: string, id: string, suffix: string) =>
        prefix + resolveId(id) + suffix,
    );
  }
  return value.replace(
    LOCAL_SVG_URL_PATTERN,
    (_match, prefix: string, _quote: string, id: string, suffix: string) =>
      prefix + resolveId(id) + suffix,
  );
}

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
  if (Object.hasOwn(idMap, id)) {
    warnOnce(
      `duplicate-id:${id}`,
      `Duplicate id "${id}" found in template. Only the first instance will be mapped.`,
    );
  } else {
    // Define an own property even for "__proto__" on a regular object.
    Object.defineProperty(idMap, id, {
      value: target,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
}
