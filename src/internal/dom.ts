import { throwError } from './messages';

export const SVG_NAMESPACE_URI = 'http://www.w3.org/2000/svg';
export const MATHML_NAMESPACE_URI = 'http://www.w3.org/1998/Math/MathML';

/**
 * Resolves a native child's namespace, including HTML integration boundaries.
 *
 * @param target - The parent element, with its attributes already applied.
 * @param tagName - The child's tag name, when resolving MathML text exceptions.
 * @param ns - The inherited namespace; defaults to the target's namespace.
 * @returns The namespace for the child, or null to create an HTML element.
 */
export function getChildNamespace(
  target: Element,
  tagName?: string,
  ns: string | null | undefined = target.namespaceURI,
): string | null | undefined {
  const name = target.localName.toLowerCase();
  if (
    target.namespaceURI === SVG_NAMESPACE_URI &&
    ['foreignobject', 'desc', 'title'].includes(name)
  ) {
    return null;
  }
  if (target.namespaceURI === MATHML_NAMESPACE_URI) {
    if (name === 'annotation-xml') {
      const encoding = target.getAttribute('encoding');
      if (/^(?:text\/html|application\/xhtml\+xml)$/iu.test(encoding ?? '')) {
        return null;
      }
    } else if (['mi', 'mo', 'mn', 'ms', 'mtext'].includes(name)) {
      return tagName === 'mglyph' || tagName === 'malignmark'
        ? MATHML_NAMESPACE_URI
        : null;
    }
  }
  return ns;
}

/**
 * Checks whether the given string is a valid HTML/XML tag name.
 *
 * @param tagName - The tag name to check.
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
    throwError(`Invalid tag name: ${tagName}`);
  }

  let elementNs = ns;
  if (tagName === 'svg') {
    elementNs = SVG_NAMESPACE_URI;
  } else if (tagName === 'math') {
    elementNs = MATHML_NAMESPACE_URI;
  }

  const element = elementNs
    ? document.createElementNS(elementNs, tagName)
    : document.createElement(tagName);

  const childNs =
    tagName === 'foreignobject' && elementNs === SVG_NAMESPACE_URI
      ? null
      : elementNs;

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
      // Skip specific attributes
      continue;
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
