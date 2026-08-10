export const FORBIDDEN_TAG_NAMES: ReadonlySet<string> = new Set([
  // Script execution
  'script',
  'noscript',

  // Embedding external contexts
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'portal',

  // Modifying document metadata
  'base',
  'meta',
  'link',
  'style',
  'title',

  // Embedding HTML inside SVG
  'foreignobject',

  // Embedding HTML/XHTML inside MathML
  'annotation-xml',

  // Deprecated and potentially dangerous legacy elements
  'marquee',
  'blink',
  'xmp',
  'plaintext',
  'listing',
]);

export const URL_ATTRIBUTES = new Set([
  'href',
  'src',
  'action',
  'formaction',
  'xlink:href',
  'poster',
  'cite',
  'data',
  'codebase',
  'ping',
  'icon',
]);

export const BLOCKED_ATTRIBUTES = new Set(['srcdoc']);

export const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Checks whether the given string is a valid HTML/XML tag name.
 *
 * @param tagName - The tag name to check.
 * @returns True if the tag name is valid.
 */
export function isSafeTagName(tagName: string): boolean {
  const normalized = tagName.toLowerCase();
  return (
    /^[a-z][a-z0-9-]*$/u.test(normalized) &&
    !FORBIDDEN_TAG_NAMES.has(normalized)
  );
}

export function isSafeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    const url = new URL(trimmed, 'https://localhost');
    return ALLOWED_SCHEMES.has(url.protocol);
  } catch {
    return false;
  }
}

export function isSafeSrcset(value: string): boolean {
  const entries = value.split(',');
  return entries.every((entry) => {
    const urlPart = entry.trim().split(/\s+/)[0];
    return !urlPart || isSafeUrl(urlPart);
  });
}

/**
 * Determines whether an attribute value is safe to use based on its attribute name.
 *
 * @param name - The attribute name to validate.
 * @param value - The attribute value to validate.
 * @returns `true` if the attribute value is safe for the given attribute name;
 * otherwise, `false`.
 */
export function isSafeAttributeValue(name: string, value: string): boolean {
  const lowerName = name.toLowerCase();

  if (lowerName.startsWith('on') || BLOCKED_ATTRIBUTES.has(lowerName)) {
    return false;
  }

  if (lowerName === 'srcset') {
    return isSafeSrcset(value);
  }

  if (URL_ATTRIBUTES.has(lowerName)) {
    return isSafeUrl(value);
  }

  return true;
}
