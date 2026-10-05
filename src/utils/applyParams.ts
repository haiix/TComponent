import type { ComponentParams } from '../types';
import { TComponent } from '../TComponent';
import { appendSlots } from '../internal/slots';
import { applyAttributes, normalizeAttributeName } from '../internal/dom';
import { bindEvent } from '../internal/event';
import { hasIdReference } from '../internal/id';

/**
 * Applies component parameters (attributes and child nodes) to a specific target DOM element.
 * Its primary use is to forward received attributes and slots once during initialization
 * to either the component's root element or a specific internal element.
 *
 * Applying parameters after construction is also supported, with these behaviors on each call:
 *
 * - Ordinary attributes overwrite the supplied attributes; omitted attributes are not removed.
 * - `class` adds tokens to `classList` without duplicates or removing existing classes.
 * - `style` appends declarations without removing previous declarations; CSS precedence applies.
 * - Event attributes add listeners without replacing earlier listeners. Reapplying the same
 *   event attribute, even with the same method name, invokes the method multiple times per event.
 * - Child nodes are appended without replacing existing children.
 *
 * Internal attributes like `id` are ignored.
 *
 * Reapplying the same parameters does not preserve the same state, so do not use whole-params
 * reapplication for state updates. Instead, explicitly update DOM attributes, `classList`,
 * styles, or children, or use the component's public methods.
 * Event wrappers resolve methods at execution time: replace the handler method's implementation
 * on the component providing the handler, or branch on state within that method, without reapplying
 * parameters. In subclasses, avoid forwarding the same parameters to a target already handled
 * by the base class.
 *
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
    const attributeNames = new Set<string>();
    for (const [originalName, value] of entries) {
      const name = normalizeAttributeName(target, originalName);
      attributeNames.add(name);
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
    // Cancel earlier applications for these attributes, preserving other pending references.
    const pendingReferences = contextComponent.context.idReferenceMap;
    let retainedCount = 0;
    for (const reference of pendingReferences) {
      if (
        reference.element !== target ||
        !attributeNames.has(normalizeAttributeName(target, reference.attrName))
      ) {
        pendingReferences[retainedCount++] = reference;
      }
    }
    pendingReferences.length = retainedCount;
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
