import type { ComponentParams, TNode } from './types';
import type { AbstractComponent } from './AbstractComponent';
import { warnOnce } from './utils/console';

/**
 * Syntax of supported event handlers
 * Matches "method", "this.method", "method(event)", "return method()", " this . method ( event ) ; ", etc.,
 * and extracts the method name into Group 1.
 */
const EVENT_HANDLER_REGEX =
  /^\s*(?:return\s+)?(?:this\s*\.\s*)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:\(\s*(?:event)?\s*\))?\s*;?\s*$/u;

/**
 * List of attributes that reference elements by their ID.
 */
const ID_REF_ATTRIBUTES = new Set([
  'for',
  'aria-labelledby',
  'aria-describedby',
  'aria-controls',
  'aria-owns',
  'aria-activedescendant',
  'aria-flowto',
  'aria-errormessage',
  'aria-details',
  'headers',
  'list',
]);

/**
 * Checks whether the given string is a valid HTML/XML tag name.
 *
 * @param tagName The tag name to check.
 * @returns True if the tag name is valid.
 */
function isSafeTagName(tagName: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9-]*$/u.test(tagName);
}

/**
 * Wraps a function and returns a new event handler that forwards all errors to `onerror`.
 *
 * @param component - The component instance.
 * @param fn - The function to execute when the event occurs.
 * @returns A new event handler function that wraps `fn` with error handling.
 */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */
function createEventHandler(component: AbstractComponent, fn: Function) {
  /* eslint-enable @typescript-eslint/no-unsafe-function-type */
  return (event: Event): void => {
    try {
      const result = fn.call(component, event) as unknown;
      if (result instanceof Promise) {
        result.catch((error: unknown) => {
          component.onerror(error);
        });
      } else if (result === false) {
        event.preventDefault();
      }
    } catch (error) {
      component.onerror(error);
    }
  };
}

/**
 * Generates a unique identifier string.
 *
 * @returns A unique identifier string. The value will either be a UUID
 * (when `crypto.randomUUID` is available) or a pseudo-random fallback ID.
 */
function generateId(): string {
  /* eslint-disable @typescript-eslint/no-unnecessary-condition */
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `tcomp-${Math.random().toString(36).slice(2, 11)}`;
  /* eslint-enable @typescript-eslint/no-unnecessary-condition */
}

/**
 * Registers an element or component to the `idMap` using its original template ID.
 * Implements a "first-wins" strategy: if the ID already exists, it logs a warning
 * and ignores the subsequent registration, mirroring standard DOM behavior.
 *
 * @param idMap - The dictionary mapping original IDs to elements or components.
 * @param id - The original ID string defined in the template.
 * @param target - The DOM Element or AbstractComponent instance to be registered.
 */
function registerId(
  idMap: Record<string, AbstractComponent | Element>,
  id: string,
  target: Element | AbstractComponent,
): void {
  if (id in idMap) {
    warnOnce(
      `duplicate-id:${id}`,
      `Duplicate id "${id}" found in template. Only the first instance will be mapped.`,
    );
  } else {
    idMap[id] = target;
  }
}

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
   * @param tNode - The root `TNode` to build from.
   * @param component - The component instance that owns this template.
   * @param uses - A map of custom component classes to be used within the template.
   * @param parentSignal - An AbortSignal to clean up event listeners.
   * @returns An object containing the built root element and a map of original IDs to uniquely generated elements.
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
    const { idMap, idReferenceMap, component, uses, signal } = this;

    if (tNode.t in uses) {
      const Component = uses[tNode.t] as new (
        params: ComponentParams,
      ) => AbstractComponent;
      const cComponent = new Component({
        parent: component,
        attributes: tNode.a,
        childNodes: tNode.c,
        signal,
      });
      if (tNode.a.id) {
        registerId(idMap, tNode.a.id, cComponent);
      }
      return cComponent.element;
    }

    const tagName = tNode.t;
    if (!isSafeTagName(tagName)) {
      throw new Error(`Invalid tag name: ${tagName}`);
    }

    let elementNs = ns;
    if (tNode.t === 'svg') {
      elementNs = 'http://www.w3.org/2000/svg';
    } else if (tNode.t === 'math') {
      elementNs = 'http://www.w3.org/1998/Math/MathML';
    }

    const element: Element = elementNs
      ? document.createElementNS(elementNs, tagName)
      : document.createElement(tagName);

    for (const [name, value] of Object.entries(tNode.a)) {
      if (name === 'id') {
        element.id = generateId();
        registerId(idMap, value, element);
      } else if (ID_REF_ATTRIBUTES.has(name)) {
        idReferenceMap.push({ attrName: name, refId: value, element });
      } else if (name.startsWith('on')) {
        const match = EVENT_HANDLER_REGEX.exec(value);

        const methodName = match?.[1];
        if (!methodName) {
          throw new Error(
            `SecurityError: Invalid event handler signature in attribute "${name}": "${value}"`,
          );
        }
        if (methodName === 'constructor' || methodName === '__proto__') {
          throw new Error(
            `SecurityError: Access to "${methodName}" is forbidden.`,
          );
        }

        const fn = (component as unknown as Record<string, unknown>)[
          methodName
        ];
        if (typeof fn === 'function') {
          const eventType = name.slice(2).toLowerCase();
          const wrappedFn = createEventHandler(component, fn);
          element.addEventListener(eventType, wrappedFn, { signal });
        } else {
          warnOnce(
            `missing-method:${component.constructor.name}:${methodName}`,
            `Method "${methodName}" not found on component for event "${name}"`,
          );
        }
      } else {
        element.setAttribute(name, value);
      }
    }

    for (const cNode of tNode.c) {
      if (typeof cNode === 'string') {
        element.appendChild(document.createTextNode(cNode));
      } else {
        const childNs = tNode.t === 'foreignobject' ? null : elementNs;
        element.appendChild(this.build(cNode, childNs));
      }
    }

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
}
