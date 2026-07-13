import type { ComponentParams, IDReferenceEntry, TNode } from './types';
import { EVENT_HANDLER_REGEX, createEventHandler } from './internal/event';
import { ID_REF_ATTRIBUTES, generateId, registerId } from './internal/id';
import type { AbstractComponent } from './AbstractComponent';
import { createNativeElement } from './internal/dom';
import { warnOnce } from './internal/console';

/**
 * Context object used during the recursive build process.
 */
export class BuildContext {
  /** Map of original IDs to newly generated unique elements. */
  readonly idMap: Record<string, Element | AbstractComponent> = {};
  /** List of elements that reference other elements by ID, needing resolution. */
  readonly idReferenceMap: IDReferenceEntry[] = [];

  /** The component instance that owns the template being built. */
  readonly component: AbstractComponent;
  /** A dictionary of custom components to be used within the template. */
  readonly uses: Record<string, typeof AbstractComponent>;

  /**
   * Builds a DOM tree from a parsed template (`TNode`) and resolves ID references.
   *
   * @param component - The component instance that owns this template.
   * @param uses - A map of custom component classes to be used within the template.
   */
  constructor(
    component: AbstractComponent,
    uses: Record<string, typeof AbstractComponent>,
  ) {
    this.component = component;
    this.uses = uses;
  }

  /**
   * Recursively builds a DOM tree from a `TNode` and stores the states in `idMap` and `idReferenceMap`.
   *
   * @param tNode - The current `TNode` to build.
   * @param ns - Namespace URI used when creating an element.
   * @returns The constructed DOM Element.
   */
  build(tNode: TNode, ns?: string | null): Element {
    const { element, childNs } = createNativeElement(tNode.t, ns);
    this.processAttributes(element, tNode.a);
    this.appendChildren(element, tNode.c, childNs);

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
          if (target instanceof Element) {
            target.id ||= generateId();
            return target.id;
          }
          // For custom components (AbstractComponent) or unresolvable IDs,
          // Leave the original string as-is and defer handling to the child component.
          return id;
        })
        .join(' ');

      element.setAttribute(attrName, resolvedIds);
    }
    this.idReferenceMap.length = 0;
  }

  private buildCustomComponent(tNode: TNode): Element {
    const Component = this.uses[tNode.t] as new (
      params: ComponentParams,
    ) => AbstractComponent;
    const childComponent = new Component({
      parent: this.component,
      attributes: tNode.a,
      childNodes: tNode.c,
    });

    if (tNode.a.id) {
      registerId(this.idMap, tNode.a.id, childComponent);
    }

    return childComponent.element;
  }

  private processAttributes(
    element: Element,
    attributes: Record<string, string>,
  ): void {
    for (const [name, value] of Object.entries(attributes)) {
      if (name === 'id') {
        registerId(this.idMap, value, element);
      } else if (ID_REF_ATTRIBUTES.has(name)) {
        this.idReferenceMap.push({ attrName: name, refId: value, element });
      } else if (name.startsWith('on')) {
        this.bindEvent(element, name, value);
      } else {
        element.setAttribute(name, value);
      }
    }
  }

  private bindEvent(
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
      const wrappedFn = createEventHandler(this.component, methodName);

      element.addEventListener(eventType, wrappedFn, {
        signal: this.component.signal,
      });
    } else {
      warnOnce(
        `missing-method:${this.component.constructor.name}:${methodName}`,
        `Method "${methodName}" not found on component for event "${attrName}"`,
      );
    }
  }

  /**
   * Builds child nodes and appends them to the specified element.
   *
   * @param element - The parent element to append child nodes to.
   * @param children - The child nodes or text content to append.
   * @param childNs - The namespace URI used when creating child elements.
   */
  appendChildren(
    element: Element,
    children: (TNode | string)[],
    childNs?: string | null,
  ): void {
    for (const childNode of children) {
      element.appendChild(
        typeof childNode === 'string'
          ? document.createTextNode(childNode)
          : this.uses[childNode.t]
            ? this.buildCustomComponent(childNode)
            : this.build(childNode, childNs),
      );
    }
  }
}
