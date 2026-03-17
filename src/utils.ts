import { type ComponentParams, TComponent } from './TComponent';

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
 * class App extends TComponent {
 *   static uses = kebabKeys({ DynamicList, UserProfile });
 *   // Results in: { 'dynamic-list': DynamicList, 'user-profile': UserProfile }
 * }
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

/**
 * Applies component parameters (attributes and child nodes) to a specific target DOM element.
 * This utility drastically simplifies routing "Props" (attributes) and "Slots" (childNodes)
 * to either the component's root element or a specific internal element.
 *
 * It smartly handles merging of `class` and `style` attributes, and skips `id` and `on*`
 * attributes to prevent DOM conflicts and invalid inline event handlers.
 *
 * @example
 * class Card extends TComponent<HTMLDivElement> {
 *   static template = `<div class="card"><div id="body"></div></div>`;
 *   constructor(params: ComponentParams) {
 *     super(params);
 *     // Inject props and slots into the internal body element
 *     applyParams(this, this.idMap['body'], params);
 *   }
 * }
 *
 * @param component - The current component instance.
 * @param target - The DOM element to receive the attributes and children.
 * @param params - The ComponentParams object containing attributes and childNodes.
 */
export function applyParams(
  component: TComponent,
  target: Element,
  params: ComponentParams,
): void {
  // 1. Apply Attributes (Props)
  if (params.attributes) {
    for (const [name, value] of Object.entries(params.attributes)) {
      if (name === 'id' || name.startsWith('on')) {
        continue; // Skip 'id' and 'on*' attributes.
      }

      if (name === 'class') {
        const classes = value.trim().split(/\s+/u).filter(Boolean);
        if (classes.length) target.classList.add(...classes);
      } else if (name === 'style') {
        const existingStyle = target.getAttribute('style')?.trim() ?? '';
        const appendStyle = value.trim();

        if (existingStyle && appendStyle) {
          const separator = existingStyle.endsWith(';') ? ' ' : '; ';
          target.setAttribute('style', existingStyle + separator + appendStyle);
        } else {
          target.setAttribute('style', existingStyle || appendStyle);
        }
      } else {
        target.setAttribute(name, value);
      }
    }
  }

  // 2. Append Child Nodes (Slots)
  if (params.childNodes && params.childNodes.length > 0) {
    // Since slots are defined in the parent component's template,
    // if a parent exists, the context (event handlers and `uses`) should be directed to the parent.
    const contextComponent =
      component.parent instanceof TComponent ? component.parent : component;

    for (const child of params.childNodes) {
      target.appendChild(
        typeof child === 'string'
          ? document.createTextNode(child)
          : contextComponent.context.build(child),
      );
    }
  }
}
