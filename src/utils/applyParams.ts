import type { ComponentParams } from '../types';
import { TComponent } from '../TComponent';
import { appendSlots } from '../internal/slots';
import { applyAttributes } from '../internal/dom';
import { bindEvent } from '../internal/event';

/**
 * Applies component parameters (attributes and child nodes) to a specific target DOM element.
 * This utility drastically simplifies routing "Props" (attributes) and "Slots" (childNodes)
 * to either the component's root element or a specific internal element.
 *
 * It smartly handles merging of `class` and `style` attributes, bindings of events,
 * and safely ignores internal attributes like `id`.
 *
 * @example
 * ```typescript
 * class Card extends TComponent<HTMLDivElement> {
 *   static template = `<div class="card"><div id="body"></div></div>`;
 *   constructor(params: ComponentParams) {
 *     super(params);
 *     // Inject props and slots into the internal body element
 *     applyParams(this, this.getById('body', HTMLDivElement), params);
 *   }
 * }
 * ```
 *
 * @param component - The current component instance.
 * @param target - The DOM element to receive the attributes and children.
 * @param params - The ComponentParams object containing attributes and childNodes.
 */
export function applyParams(
  component: TComponent,
  target: Element,
  params: ComponentParams = {},
): void {
  // Resolve the context once.
  // Slots and events passed from the outside should be evaluated in the parent's context.
  const contextComponent =
    component.parent instanceof TComponent
      ? (component.parent as TComponent)
      : component;

  if (params.attributes) {
    for (const [name, value] of Object.entries(params.attributes)) {
      if (name.startsWith('on')) {
        // Bind events using the resolved context (usually the parent),
        // but strictly tie the event lifecycle (AbortSignal) to the current child component
        // so that memory is freed when the child is destroyed.
        bindEvent(target, name, value, contextComponent, component.signal);
      }
    }
    // applyAttributes internally ignores 'id' and 'on*'
    // so it safely handles the remaining standard attributes (class, style, data-*, etc.)
    applyAttributes(target, params.attributes);
  }

  if (params.childNodes) {
    appendSlots(contextComponent, target, params.childNodes);
  }
}
