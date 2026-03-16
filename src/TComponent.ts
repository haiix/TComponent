/**
 * Represents an Abstract Syntax Tree (AST) node of a parsed template.
 */
export interface TNode {
  /** The tag name of the element (converted to lowercase). */
  t: string;
  /** A dictionary of the element's attributes. */
  a: Record<string, string>;
  /** An array of child nodes, which can be either `TNode` objects or plain text strings. */
  c: (TNode | string)[];
}

/**
 * Options required for template parsing.
 */
export interface ParseOptions {
  /**
   * Preserve text nodes that consist only of newline whitespace.
   * When false, newline-only whitespace between elements is removed.
   * @default false
   */
  preserveWhitespace?: boolean;
}

/**
 * Recursively parses a DOM Node into a `TNode` or a text string.
 *
 * @param node - The DOM node to parse.
 * @param options - Options for parsing.
 * @returns A parsed `TNode`, a text string, or `null` if the node should be ignored.
 */
function parseTemplateRecur(
  node: Node,
  options: ParseOptions,
): TNode | string | null {
  if (node instanceof Element) {
    return {
      t: node.tagName.toLowerCase(),
      a: Object.fromEntries(
        Array.from(node.attributes, (attr) => [attr.name, attr.value]),
      ),
      c: Array.from(node.childNodes, (cNode) =>
        parseTemplateRecur(cNode, options),
      ).filter((cNode): cNode is TNode | string => cNode != null),
    };
  }

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    // Exclude text nodes that are completely empty or contain only line breaks (keep single spaces, etc.)
    const isEmpty =
      !options.preserveWhitespace && !text.trim() && text.includes('\n');
    return isEmpty ? null : text;
  }

  return null;
}

/**
 * Parses an HTML template string into a `TNode` tree.
 *
 * @param html - The HTML string to parse.
 * @param options - Options for parsing.
 * @returns The parsed `TNode` representation of the root element.
 * @throws {Error} If the template does not have exactly one root element.
 */
export function parseTemplate(html: string, options: ParseOptions = {}): TNode {
  const template = document.createElement('template');
  template.innerHTML = html.trim();

  if (template.content.children.length !== 1) {
    throw new Error(
      'ParseError: The template must have exactly one root element.',
    );
  }
  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  return parseTemplateRecur(
    template.content.firstElementChild!,
    options,
  ) as TNode;
  /* eslint-enable @typescript-eslint/no-non-null-assertion */
}

/**
 * Parameters required to initialize a component.
 */
export interface ComponentParams {
  /** The parent component instance, if any. */
  parent?: AbstractComponent;
  /** Attributes passed down to the component. */
  attributes?: Record<string, string>;
  /** Child nodes passed to the component. */
  childNodes?: (TNode | string)[];
  /** An `AbortSignal` used to manage event listeners and component teardown. */
  signal?: AbortSignal;
}

/**
 * The base abstract class for all components.
 * Provides basic properties to manage the component hierarchy, attributes, and children.
 */
export abstract class AbstractComponent {
  /** The root DOM Element of the component. */
  abstract element: Element;
  /** The parent component instance, if any. */
  parent?: AbstractComponent;

  /**
   * Creates an instance of `AbstractComponent`.
   *
   * @param params - The initialization parameters.
   */
  constructor(params?: ComponentParams) {
    this.parent = params?.parent;
  }

  /**
   * Handles errors by delegating them to the parent component, or throws if there is no parent.
   *
   * @param error - The error to be handled.
   */
  onerror(error: unknown): void {
    if (this.parent) {
      this.parent.onerror(error);
    } else {
      throw error;
    }
  }
}

/**
 * Context object used during the recursive build process.
 */
interface BuildContext {
  /** Map of original IDs to newly generated unique elements. */
  idMap: Record<string, Element | AbstractComponent>;
  /** List of elements that reference other elements by ID, needing resolution. */
  idReferenceMap: { attrName: string; refId: string; element: Element }[];
  /** The component instance that owns the template being built. */
  component: AbstractComponent;
  /** A dictionary of custom components to be used within the template. */
  uses: Record<string, typeof AbstractComponent>;
  /** An `AbortSignal` to attach to event listeners. */
  signal?: AbortSignal;
}

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
 * Wraps a function and returns a new event handler that forwards all errors to `onerror`.
 *
 * @param component - The component instance.
 * @param fn - The function to execute when the event occurs.
 * @returns A new event handler function that wraps `fn` with error handling.
 */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */
export function createEventHandler(component: AbstractComponent, fn: Function) {
  /* eslint-enable @typescript-eslint/no-unsafe-function-type */
  return (event: Event): void => {
    try {
      const result = fn.call(component, event) as unknown;
      if (result instanceof Promise) {
        result.catch((error: unknown) => {
          component.onerror(error);
        });
      }
    } catch (error) {
      component.onerror(error);
    }
  };
}

/**
 * Checks whether the given string is a valid HTML/XML tag name.
 *
 * @param tagName The tag name to check.
 * @returns True if the tag name is valid.
 */
export function isSafeTagName(tagName: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9-]*$/u.test(tagName);
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
    : 'tcomp-' + Math.random().toString(36).slice(2, 11);
  /* eslint-enable @typescript-eslint/no-unnecessary-condition */
}

/**
 * Recursively builds a DOM tree from a `TNode`.
 *
 * @param tNode - The current `TNode` to build.
 * @param context - The context containing maps and component references.
 * @param ns - Namespace URI used when creating an element.
 * @returns The constructed DOM Element.
 */
function buildRecur(tNode: TNode, context: BuildContext, ns?: string): Element {
  const { idMap, idReferenceMap, component, uses, signal } = context;

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
      idMap[tNode.a.id] = cComponent;
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
      idMap[value] = element;
    } else if (ID_REF_ATTRIBUTES.has(name)) {
      idReferenceMap.push({ attrName: name, refId: value, element });
    } else if (name.startsWith('on')) {
      const fn = (component as unknown as Record<string, unknown>)[value];

      if (typeof fn !== 'function') {
        console.warn(
          `Method "${value}" not found on component for event "${name}"`,
        );
        continue;
      }

      const eventType = name.slice(2).toLowerCase();
      const wrappedFn = createEventHandler(component, fn);
      element.addEventListener(eventType, wrappedFn, { signal });
    } else {
      element.setAttribute(name, value);
    }
  }

  for (const cNode of tNode.c) {
    if (typeof cNode === 'string') {
      element.appendChild(document.createTextNode(cNode));
    } else {
      const childNs = tNode.t === 'foreignobject' ? undefined : elementNs;
      element.appendChild(buildRecur(cNode, context, childNs));
    }
  }

  return element;
}

/**
 * Builds a DOM tree from a parsed template (`TNode`) and resolves ID references.
 *
 * @param tNode - The root `TNode` to build from.
 * @param component - The component instance that owns this template.
 * @param uses - A map of custom component classes to be used within the template.
 * @param signal - An AbortSignal to clean up event listeners. To skip cleanup, you must explicitly pass false to prevent accidental omission.
 * @returns An object containing the built root element and a map of original IDs to uniquely generated elements.
 */
export function build(
  tNode: TNode,
  component: AbstractComponent,
  uses: Record<string, typeof AbstractComponent>,
  signal: AbortSignal | false,
): { element: Element; idMap: Record<string, Element | AbstractComponent> } {
  const idMap: Record<string, Element | AbstractComponent> = {};
  const idReferenceMap: {
    attrName: string;
    refId: string;
    element: Element;
  }[] = [];

  const context: BuildContext = {
    idMap,
    idReferenceMap,
    component,
    uses,
    signal: signal || undefined,
  };
  const element = buildRecur(tNode, context);

  for (const { attrName, refId, element: refElement } of idReferenceMap) {
    const resolvedIds = refId
      .trim()
      .split(/\s+/u)
      .map((id) => {
        const target = idMap[id];
        // For custom components (AbstractComponent) or unresolvable IDs,
        // leave the original string as-is and defer handling to the child component.
        return target instanceof Element ? target.id : id;
      })
      .join(' ');

    refElement.setAttribute(attrName, resolvedIds);
  }
  return { element, idMap };
}

/**
 * A practical base component class that automatically parses its template,
 * builds its DOM, binds events, and resolves sub-components.
 *
 * @template T - The type of the root DOM Element.
 */
export class TComponent<
  T extends Element = Element,
  IDMap = Record<string, Element | AbstractComponent>,
> extends AbstractComponent {
  /** A dictionary of custom components to be used within the template. */
  static uses: Record<string, typeof AbstractComponent> = {};
  /** The HTML string template for the component. */
  static template = '<div></div>';
  /** The options passed when parsing the template. */
  static parseOptions?: ParseOptions;

  /** Lowercased uses cache */
  static parsedUses?: Record<string, typeof AbstractComponent>;
  /** The parsed AST (`TNode`) of the HTML template. Cached across instances. */
  static parsedTemplate?: TNode;

  private static warnedNoSignal = false;

  /** The root DOM Element of the component. */
  readonly element: T;
  /** A map of original template IDs to uniquely generated DOM elements. */
  readonly idMap: IDMap = {} as IDMap;

  /**
   * Creates an instance of `TComponent`.
   *
   * @param params - The initialization parameters.
   */
  constructor(params: ComponentParams = {}) {
    super(params);

    const Component = this.constructor as typeof TComponent;

    if (
      !params.signal &&
      (!Object.hasOwn(Component, 'warnedNoSignal') || !Component.warnedNoSignal)
    ) {
      Component.warnedNoSignal = true;
      console.warn(
        `[TComponent] ${Component.name}: No AbortSignal provided. Event listeners will not be automatically removed. Pass a signal via "new ${Component.name}({ signal: controller.signal })" to enable cleanup.`,
      );
    }

    if (
      !Object.hasOwn(Component, 'parsedTemplate') ||
      !Component.parsedTemplate
    ) {
      const parseOptions = Object.hasOwn(Component, 'parseOptions')
        ? Component.parseOptions
        : {};
      Component.parsedTemplate = parseTemplate(
        Component.template,
        parseOptions,
      );
    }

    if (!Object.hasOwn(Component, 'parsedUses') || !Component.parsedUses) {
      Component.parsedUses = Object.fromEntries(
        Object.entries(Component.uses).map(([name, Comp]) => [
          name.toLowerCase(),
          Comp,
        ]),
      );
    }

    const { element, idMap } = build(
      Component.parsedTemplate,
      this,
      Component.parsedUses,
      params.signal ?? false,
    );

    this.element = element as T;
    this.idMap = { ...this.idMap, ...idMap };
  }
}

export default TComponent;
