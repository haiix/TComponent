/**
 * Checks whether the given string is a valid HTML/XML tag name.
 *
 * @param tagName The tag name to check.
 * @returns True if the tag name is valid.
 */
export function isSafeTagName(tagName: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9-]*$/u.test(tagName);
}

/**
 * Creates a native DOM element with optional namespace handling.
 *
 * @param tagName - The tag name of the element to create. Must be a valid HTML/XML tag name.
 * @param ns - Optional namespace URI to use for element creation. If not provided,
 *             the function may infer it based on the tag name (e.g., `svg`, `math`).
 *
 * @returns An object containing:
 * - `element`: The created DOM element.
 * - `childNs`: The namespace URI to be used for this element's children.
 */
export function createNativeElement(
  tagName: string,
  ns?: string | null,
): { element: Element; childNs?: string | null } {
  if (!isSafeTagName(tagName)) {
    throw new Error(`Invalid tag name: ${tagName}`);
  }

  let elementNs = ns;
  if (tagName === 'svg') {
    elementNs = 'http://www.w3.org/2000/svg';
  } else if (tagName === 'math') {
    elementNs = 'http://www.w3.org/1998/Math/MathML';
  }

  const element = elementNs
    ? document.createElementNS(elementNs, tagName)
    : document.createElement(tagName);

  const childNs = tagName === 'foreignobject' ? null : elementNs;

  return { element, childNs };
}
