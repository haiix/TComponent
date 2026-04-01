import type { ParseOptions, TNode } from '../types';

/**
 * Recursively parses a DOM Node into a `TNode` or a text string.
 *
 * @param node - The DOM node to parse.
 * @param options - Options for parsing.
 * @returns A parsed `TNode`, a text string, or `null` if the node should be ignored.
 */
function parseTemplateRecur(
  node: Node,
  options: ParseOptions,
): TNode | string | null {
  if (node instanceof Element) {
    return {
      t: node.tagName.toLowerCase(),
      a: Object.fromEntries(
        Array.from(node.attributes, (attr) => [attr.name, attr.value]),
      ),
      c: Array.from(node.childNodes, (cNode) =>
        parseTemplateRecur(cNode, options),
      ).filter((cNode): cNode is TNode | string => cNode != null),
    };
  }

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    // Exclude text nodes that are completely empty or contain only line breaks (keep single spaces, etc.)
    const isEmpty =
      !options.preserveWhitespace && !text.trim() && text.includes('\n');
    return isEmpty ? null : text;
  }

  return null;
}

/**
 * Parses an HTML template string into a `TNode` tree.
 *
 * @param html - The HTML string to parse.
 * @param options - Options for parsing.
 * @returns The parsed `TNode` representation of the root element.
 * @throws `{Error}` If the template does not have exactly one root element.
 */
export function parseTemplate(html: string, options: ParseOptions = {}): TNode {
  const template = document.createElement('template');
  template.innerHTML = html.trim();

  if (template.content.children.length !== 1) {
    throw new Error(
      'ParseError: The template must have exactly one root element.',
    );
  }
  return parseTemplateRecur(
    /* eslint-disable @typescript-eslint/no-non-null-assertion */
    template.content.firstElementChild!,
    /* eslint-enable @typescript-eslint/no-non-null-assertion */
    options,
  ) as TNode;
}
