import type { ComponentParams, TNode } from './types';
import type { AbstractComponent } from './AbstractComponent';
import { warnOnce } from './utils/console';
import { EVENT_HANDLER_REGEX, createEventHandler } from './utils/event';
import { ID_REF_ATTRIBUTES, generateId, registerId } from './utils/id';
import { isSafeTagName } from './utils/dom';

/**
 * Context object used during the recursive build process.
 */
export class BuildContext {
  /** Map of original IDs to newly generated unique elements. */
  readonly idMap: Record<string, Element | AbstractComponent> = {};
  /** List of elements that reference other elements by ID, needing resolution. */
  readonly idReferenceMap: {
    attrName: string;
    refId: string;
    element: Element;
  }[] = [];

  /** The component instance that owns the template being built. */
  readonly component: AbstractComponent;
  /** A dictionary of custom components to be used within the template. */
  readonly uses: Record<string, typeof AbstractComponent>;

  /** Controller to manage the component's own teardown. */
  readonly controller: AbortController;
  /** Signal to pass to event listeners (linked to the component's teardown). */
  readonly signal: AbortSignal;

  /**
   * Builds a DOM tree from a parsed template (`TNode`) and resolves ID references.
   *
   * @param component - The component instance that owns this template.
   * @param uses - A map of custom component classes to be used within the template.
   * @param parentSignal - An AbortSignal to clean up event listeners.
   */
  constructor(
    component: AbstractComponent,
    uses: Record<string, typeof AbstractComponent>,
    parentSignal?: AbortSignal,
  ) {
    this.component = component;
    this.uses = uses;

    this.controller = new AbortController();
    this.signal = this.controller.signal;

    if (parentSignal) {
      if (parentSignal.aborted) {
        this.controller.abort(parentSignal.reason);
      } else {
        const onParentAbort = (): void => {
          this.controller.abort(parentSignal.reason);
        };

        // [WARNING] We intentionally do NOT use `AbortSignal.any([parentSignal, this.signal])` here.
        // If the parent component is long-lived and child components are frequently created and destroyed,
        // using `AbortSignal.any()` would leave a reference to the child's signal inside the parent's signal.
        // This prevents the child from being garbage collected, causing a memory leak.
        parentSignal.addEventListener('abort', onParentAbort, { once: true });

        // If the child component is explicitly destroyed before the parent,
        // we must remove the listener from the parent's signal to ensure proper Garbage Collection (GC).
        this.signal.addEventListener(
          'abort',
          (): void => {
            parentSignal.removeEventListener('abort', onParentAbort);
          },
          { once: true },
        );
      }
    }
  }

  /**
   * Recursively builds a DOM tree from a `TNode` and stores the states in `idMap` and `idReferenceMap`.
   *
   * @param tNode - The current `TNode` to build.
   * @param ns - Namespace URI used when creating an element.
   * @returns The constructed DOM Element.
   */
  build(tNode: TNode, ns?: string | null): Element {
    if (tNode.t in this.uses) {
      return this._buildCustomComponent(tNode);
    }

    const { element, elementNs } = this._createNativeElement(tNode.t, ns);
    this._applyAttributes(element, tNode.a);
    this._appendChildren(element, tNode.t, tNode.c, elementNs);

    return element;
  }

  /**
   * Resolve stored ID references to their actual UUIDs
   */
  resolveIdReferences(): void {
    for (const { attrName, refId, element } of this.idReferenceMap) {
      const resolvedIds = refId
        .trim()
        .split(/\s+/u)
        .map((id) => {
          const target = this.idMap[id];
          // For custom components (AbstractComponent) or unresolvable IDs,
          // Leave the original string as-is and defer handling to the child component.
          return target instanceof Element ? target.id : id;
        })
        .join(' ');

      element.setAttribute(attrName, resolvedIds);
    }
    this.idReferenceMap.length = 0;
  }

  private _buildCustomComponent(tNode: TNode): Element {
    const Component = this.uses[tNode.t] as new (
      params: ComponentParams,
    ) => AbstractComponent;
    const cComponent = new Component({
      parent: this.component,
      attributes: tNode.a,
      childNodes: tNode.c,
      signal: this.signal,
    });

    if (tNode.a.id) {
      registerId(this.idMap, tNode.a.id, cComponent);
    }

    return cComponent.element;
  }

  private _createNativeElement(
    tagName: string,
    ns?: string | null,
  ): { element: Element; elementNs?: string | null } {
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

    return { element, elementNs };
  }

  private _applyAttributes(
    element: Element,
    attributes: Record<string, string>,
  ): void {
    for (const [name, value] of Object.entries(attributes)) {
      if (name === 'id') {
        element.id = generateId();
        registerId(this.idMap, value, element);
      } else if (ID_REF_ATTRIBUTES.has(name)) {
        this.idReferenceMap.push({ attrName: name, refId: value, element });
      } else if (name.startsWith('on')) {
        this._bindEvent(element, name, value);
      } else {
        element.setAttribute(name, value);
      }
    }
  }

  private _bindEvent(
    element: Element,
    attrName: string,
    attrValue: string,
  ): void {
    const match = EVENT_HANDLER_REGEX.exec(attrValue);
    const methodName = match?.[1];

    if (!methodName) {
      throw new Error(
        `SecurityError: Invalid event handler signature in attribute "${attrName}": "${attrValue}"`,
      );
    }
    if (methodName === 'constructor' || methodName === '__proto__') {
      throw new Error(`SecurityError: Access to "${methodName}" is forbidden.`);
    }

    const fn = (this.component as unknown as Record<string, unknown>)[
      methodName
    ];
    if (typeof fn === 'function') {
      const eventType = attrName.slice(2).toLowerCase();
      const wrappedFn = createEventHandler(this.component, fn);
      element.addEventListener(eventType, wrappedFn, { signal: this.signal });
    } else {
      warnOnce(
        `missing-method:${this.component.constructor.name}:${methodName}`,
        `Method "${methodName}" not found on component for event "${attrName}"`,
      );
    }
  }

  private _appendChildren(
    element: Element,
    parentTagName: string,
    children: (TNode | string)[],
    elementNs?: string | null,
  ): void {
    const childNs = parentTagName === 'foreignobject' ? null : elementNs;

    for (const cNode of children) {
      element.appendChild(
        typeof cNode === 'string'
          ? document.createTextNode(cNode)
          : this.build(cNode, childNs),
      );
    }
  }
}
