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
  setAttribute,
} from './internal/dom';
import { lifecycleSignal, type ScopedComponentParams } from './internal/signal';

/**
 * Context object used during the recursive build process.
 */
export class BuildContext {
  /**
   * Prototype-free dictionary of original IDs to elements or sub-components.
   * Strongly retains registered targets regardless of DOM connection or destruction.
   * Registrations persist across builds; duplicate IDs keep the first target.
   */
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
   * Manually created ASTs and modified copies must follow the `TNode` name format:
   * lowercase HTML tag and attribute names, and correctly cased names for SVG,
   * MathML, or XML. This method reads the AST without modifying it or providing
   * HTML-style case correction. Correct names enable ID registration, ID reference
   * resolution, and event method binding with lifecycle cleanup.
   * Unlike `applyParams()` attribute forwarding, names must already be appropriate
   * for the namespace being built. Call `resolveIdReferences()` after building
   * reference targets to resolve stored references.
   *
   * @param tNode - The current `TNode` to build, including correctly formatted names in descendants.
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

      setAttribute(element, attrName, resolvedIds);
    }
    this.idReferenceMap.length = 0;
  }

  private buildCustomComponent(
    tNode: TNode,
    componentName: string,
    signal?: AbortSignal,
  ): Element {
    const Component = this.uses[componentName] as new (
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
        setAttribute(element, name, value);
      }
    }
  }

  /**
   * Builds child nodes and appends them to the specified element.
   *
   * Manually created child ASTs and modified copies must follow the same `TNode`
   * name format as `build()`: lowercase HTML names and correctly cased SVG,
   * MathML, or XML names. Nodes are read without modification or HTML-style
   * case correction, using the existing namespace inheritance rules.
   *
   * @param element - The parent element to append child nodes to.
   * @param children - The child nodes with correctly formatted names, or text content to append.
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
      if (typeof childNode === 'string') {
        target.appendChild(document.createTextNode(childNode));
        continue;
      }
      // Keep exact keys for manually supplied ASTs; parsed uses keys are lowercase.
      const componentName = Object.hasOwn(this.uses, childNode.t)
        ? childNode.t
        : childNode.t.toLowerCase();
      target.appendChild(
        Object.hasOwn(this.uses, componentName)
          ? this.buildCustomComponent(childNode, componentName, signal)
          : this.build(
              childNode,
              getChildNamespace(element, childNode.t, childNs),
              signal,
            ),
      );
    }
  }
}
