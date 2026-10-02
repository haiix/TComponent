import type { ComponentParams } from '../types';
import { TComponent } from '../TComponent';
import { appendSlots } from '../internal/slots';
import { applyAttributes, normalizeAttributeName } from '../internal/dom';
import { bindEvent } from '../internal/event';
import { hasIdReference } from '../internal/id';

/**
 * Applies component parameters (attributes and child nodes) to a specific target DOM element.
 * This utility drastically simplifies routing "Props" (attributes) and "Slots" (childNodes)
 * to either the component's root element or a specific internal element.
 *
 * It smartly handles merging of `class` and `style` attributes, bindings of events,
 * and safely ignores internal attributes like `id`.
 * Attributes and child nodes are read-only inputs and are never modified.
 * Slot methods, IDs, and custom components resolve in the parent's scope,
 * while slot events and component cleanup follow the receiving component's lifecycle.
 * ID reference attributes also resolve in the parent's scope after its template is built.
 * Without a TComponent parent, the current component's context is used.
 * When called after that context's build-time resolution, explicitly call
 * `context.resolveIdReferences()` after applying parameters and building reference targets.
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
  // Slots, events, and ID references from the outside use the parent's context.
  const contextComponent =
    component.parent instanceof TComponent
      ? (component.parent as TComponent)
      : component;

  if (params.attributes) {
    const entries = Object.entries(params.attributes);
    const references = new Map<string, string>();
    for (const [originalName, value] of entries) {
      const name = normalizeAttributeName(target, originalName);
      // A later value for the same DOM attribute supersedes a deferred reference.
      references.delete(name);
      if (hasIdReference(name, value, target)) {
        references.set(name, value);
      } else if (name.startsWith('on')) {
        // Bind events using the resolved context (usually the parent),
        // but strictly tie the event lifecycle (AbortSignal) to the current child component
        // so that memory is freed when the child is destroyed.
        bindEvent(target, name, value, contextComponent, component.signal);
      }
    }
    // Only defer references that have not been superseded by a later attribute.
    for (const [attrName, refId] of references) {
      contextComponent.context.idReferenceMap.push({
        attrName,
        refId,
        element: target,
      });
    }
    // Keep deferred references out of direct DOM assignment without mutating params.
    // applyAttributes internally ignores 'id' and 'on*'.
    applyAttributes(
      target,
      Object.fromEntries(
        entries.filter(
          ([name, value]) =>
            !hasIdReference(
              normalizeAttributeName(target, name),
              value,
              target,
            ),
        ),
      ),
    );
  }

  if (params.childNodes) {
    appendSlots(contextComponent, target, params.childNodes, component.signal);
  }
}
