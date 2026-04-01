/**
 * Converts a string to kebab-case.
 * Safely handles PascalCase, camelCase, and consecutive uppercase letters (acronyms).
 *
 * @example
 * toKebabCase('DynamicList') // 'dynamic-list'
 * toKebabCase('XMLParser')   // 'xml-parser'
 *
 * @param str - The string to convert.
 * @returns The converted kebab-case string.
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/gu, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/gu, '$1-$2')
    .toLowerCase();
}

/**
 * Converts the keys of an object to kebab-case and returns a new object.
 * This is particularly useful for registering sub-components in `TComponent.uses`
 * using object shorthand notation, automatically generating standard HTML tag names.
 *
 * @example
 * ```typescript
 * class App extends TComponent {
 *   static uses = kebabKeys({ DynamicList, UserProfile });
 *   // Results in: { 'dynamic-list': DynamicList, 'user-profile': UserProfile }
 * }
 * ```
 *
 * @param obj - The object whose keys should be converted.
 * @returns A new object with kebab-cased keys.
 */
export function kebabKeys<T>(obj: Record<string, T>): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[toKebabCase(key)] = value;
  }
  return result;
}
