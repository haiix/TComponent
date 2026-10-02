import type { ComponentParams, IDReferenceEntry, TNode } from './types';
import {
  isIdReferenceAttribute,
  resolveIdReferenceValue,
  generateId,
  registerId,
} from './internal/id';
import type { AbstractComponent } from './AbstractComponent';
import { bindEvent } from './internal/event';
import {
  createNativeElement,
  getChildNamespace,
  SVG_NAMESPACE_URI,
} from './internal/dom';
import { lifecycleSignal, type ScopedComponentParams } from './internal/signal';

/**
 * Context object used during the recursive build process.
 */
export class BuildContext {
  /** Prototype-free dictionary of original IDs to elements or sub-components. */
  readonly idMap = Object.create(null) as Record<
    string,
    Element | AbstractComponent
  >;
  /** List of elements that reference other elements by ID, needing resolution. */
  readonly idReferenceMap: IDReferenceEntry[] = [];

  /** The component instance that owns the template being built. */
  readonly component: AbstractComponent;
  /** A dictionary of custom components to be used within the template. */
  readonly uses: Readonly<Record<string, typeof AbstractComponent>>;

  /**
   * Builds a DOM tree from a parsed template (`TNode`) and resolves ID references.
   *
   * @param component - The component instance that owns this template.
   * @param uses - A map of custom component classes to be used within the template.
   */
  constructor(
    component: AbstractComponent,
    uses: Readonly<Record<string, typeof AbstractComponent>>,
  ) {
    this.component = component;
    this.uses = uses;
  }

  /**
   * Recursively builds a DOM tree from a `TNode` and stores the states in `idMap` and `idReferenceMap`.
   *
   * @param tNode - The current `TNode` to build.
   * @param ns - Namespace URI used when creating an element.
   * @param signal - Optional lifecycle signal, independent of the template scope.
   * @returns The constructed DOM Element.
   */
  build(tNode: TNode, ns?: string | null, signal?: AbortSignal): Element {
    const { element, childNs } = createNativeElement(tNode.t, ns);
    this.processAttributes(element, tNode.a, signal);
    this.appendChildren(element, tNode.c, childNs, signal);

    return element;
  }

  /**
   * Resolve stored ID references to their actual UUIDs
   */
  resolveIdReferences(): void {
    for (const { attrName, refId, element } of this.idReferenceMap) {
      const resolvedIds = resolveIdReferenceValue(attrName, refId, (id) => {
        const target = this.idMap[id];
        if (target instanceof Element) {
          target.id ||= generateId();
          return target.id;
        }
        // For custom components (AbstractComponent) or unresolvable IDs,
        // Leave the original string as-is and defer handling to the child component.
        return id;
      });

      if (
        attrName === 'xlink:href' &&
        element.namespaceURI === SVG_NAMESPACE_URI
      ) {
        element.setAttributeNS(
          'http://www.w3.org/1999/xlink',
          attrName,
          resolvedIds,
        );
      } else {
        element.setAttribute(attrName, resolvedIds);
      }
    }
    this.idReferenceMap.length = 0;
  }

  private buildCustomComponent(tNode: TNode, signal?: AbortSignal): Element {
    const Component = this.uses[tNode.t] as new (
      params: ComponentParams,
    ) => AbstractComponent;
    const params: ScopedComponentParams = {
      parent: this.component,
      attributes: tNode.a,
      childNodes: tNode.c,
      [lifecycleSignal]: signal,
    };
    const childComponent = new Component(params);

    if (tNode.a.id) {
      registerId(this.idMap, tNode.a.id, childComponent);
    }

    return childComponent.element;
  }

  private processAttributes(
    element: Element,
    attributes: Readonly<Record<string, string>>,
    signal?: AbortSignal,
  ): void {
    for (const [name, value] of Object.entries(attributes)) {
      if (name === 'id') {
        registerId(this.idMap, value, element);
      } else if (isIdReferenceAttribute(name, element)) {
        this.idReferenceMap.push({ attrName: name, refId: value, element });
      } else if (name.startsWith('on')) {
        bindEvent(
          element,
          name,
          value,
          this.component,
          signal ?? this.component.signal,
        );
      } else {
        element.setAttribute(name, value);
      }
    }
  }

  /**
   * Builds child nodes and appends them to the specified element.
   *
   * @param element - The parent element to append child nodes to.
   * @param children - The child nodes or text content to append.
   * @param childNs - The inherited namespace URI, defaulting to the parent's namespace.
   * HTML integration boundaries are resolved for each native child.
   * @param signal - Optional lifecycle signal for events and custom components.
   */
  appendChildren(
    element: Element,
    children: readonly (TNode | string)[],
    childNs?: string | null,
    signal?: AbortSignal,
  ): void {
    const target =
      element instanceof HTMLTemplateElement ? element.content : element;
    for (const childNode of children) {
      target.appendChild(
        typeof childNode === 'string'
          ? document.createTextNode(childNode)
          : Object.hasOwn(this.uses, childNode.t)
            ? this.buildCustomComponent(childNode, signal)
            : this.build(
                childNode,
                getChildNamespace(element, childNode.t, childNs),
                signal,
              ),
      );
    }
  }
}
