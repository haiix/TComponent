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

/**
 * Safely merges a class string into the target element's classList.
 *
 * @param target - The DOM element to apply the classes to.
 * @param classValue - A space-separated string of class names.
 */
export function mergeClass(target: Element, classValue: string): void {
  const classes = classValue.trim().split(/\s+/u).filter(Boolean);
  if (classes.length) {
    target.classList.add(...classes);
  }
}

/**
 * Safely merges an inline style string into the target element's existing styles.
 * Ensures proper semicolon separation.
 *
 * @param target - The DOM element to apply the styles to.
 * @param styleValue - The CSS style string to append.
 */
export function mergeStyle(target: Element, styleValue: string): void {
  const existingStyle = target.getAttribute('style')?.trim() ?? '';
  const appendStyle = styleValue.trim();

  if (!appendStyle) return;

  if (existingStyle) {
    const separator = existingStyle.endsWith(';') ? ' ' : '; ';
    target.setAttribute('style', existingStyle + separator + appendStyle);
  } else {
    target.setAttribute('style', appendStyle);
  }
}

/**
 * Applies a dictionary of attributes to a target DOM element.
 * Intentionally skips 'id' and 'on*' attributes to prevent DOM collisions
 * and unsafe inline event handlers. Routes 'class' and 'style' to their respective merge functions.
 *
 * @param target - The DOM element to receive the attributes.
 * @param attributes - A record of attribute names and values.
 */
export function applyAttributes(
  target: Element,
  attributes: Record<string, string>,
): void {
  for (const [name, value] of Object.entries(attributes)) {
    if (name === 'id' || name.startsWith('on')) {
      continue; // Skip specific attributes
    }

    if (name === 'class') {
      mergeClass(target, value);
    } else if (name === 'style') {
      mergeStyle(target, value);
    } else {
      target.setAttribute(name, value);
    }
  }
}
