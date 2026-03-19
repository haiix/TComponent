import type { ComponentParams } from '../types';
import { TComponent } from '../TComponent';

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
        // Skip 'id' and 'on*' attributes.
      } else if (name === 'class') {
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
    // If a parent exists, the context (event handlers and `uses`) should be directed to the parent.
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
