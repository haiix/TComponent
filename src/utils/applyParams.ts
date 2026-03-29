import type { ComponentParams } from '../types';
import type { TComponent } from '../TComponent';
import { appendSlots } from '../internal/slots';
import { applyAttributes } from '../internal/dom';

/**
 * Applies component parameters (attributes and child nodes) to a specific target DOM element.
 * This utility drastically simplifies routing "Props" (attributes) and "Slots" (childNodes)
 * to either the component's root element or a specific internal element.
 *
 * It smartly handles merging of `class` and `style` attributes, and safely ignores
 * internal attributes like `id` and `on*`.
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
  if (params.attributes) {
    applyAttributes(target, params.attributes);
  }

  if (params.childNodes) {
    appendSlots(component, target, params.childNodes);
  }
}
