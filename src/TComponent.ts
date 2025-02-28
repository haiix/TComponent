/*
 * TComponent.ts
 *
 * Copyright (c) 2024 haiix
 *
 * This software is released under the MIT license.
 * See: https://opensource.org/licenses/MIT
 */

/**
 * The version of TComponent.
 * @public
 */
export const version = '1.1.2';

/**
 * The regex flags for the regex used in the parseTemplate function.
 * @public
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ConstructorOf<T> = new (...args: any[]) => T;

/**
 * Generic type representing a function.
 * @public
 */
export type AnyFunction = (...args: unknown[]) => unknown;

/**
 * TComponent attributes.
 * @public
 */
export type TAttributes = Record<string, string>;

/**
 * TNode type intermediate.
 * @public
 */
export interface IntermediateTNode {
  t: string;
  a: TAttributes;
  c: TNode[];
}

/**
 * TNode type.
 * @public
 */
export type TNode = IntermediateTNode | string;

/**
 * Checks if the value is an object.
 * @param value - The value to check.
 * @returns True if the value is an object, otherwise false.
 * @public
 */
export function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

/**
 * Checks if the target is a function.
 * @param target - The target to check.
 * @returns True if the target is a function, otherwise false.
 * @public
 */
export function isFunction(target: unknown): target is AnyFunction {
  return typeof target === 'function';
}

/**
 * Creates a dictionary object.
 * @returns A new dictionary object.
 * @public
 */
export function createDictionary<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

/**
 * Removes null and undefined values from an array.
 * @param arr - The array to filter.
 * @returns A new array without null and undefined values.
 * @public
 */
export function removeNull<T>(arr: (T | null | undefined)[]): T[] {
  return arr.filter((value): value is T => value != null);
}

/**
 * Creates a new function from the given arguments.
 * @param args - The arguments for the function.
 * @returns The created function.
 */
function createFunction(...args: string[]): AnyFunction {
  // eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
  return new Function(...args) as AnyFunction;
}

/**
 * Parses the arguments of a tag.
 * @param start - The start tag.
 * @param attrs - The attributes string.
 * @returns The parsed IntermediateTNode.
 */
function parseArguments(start: string, attrs: string): IntermediateTNode {
  const newNode: IntermediateTNode = { t: start, a: {}, c: [] };
  const attrRe = /\s+([^\s=>]+)(?:="([^"]*)"|='([^']*)'|(=))?/suy;
  let match;
  while ((match = attrRe.exec(attrs))) {
    const [, key, dqValue, sqValue, invalid] = match;
    if (invalid) {
      throw new Error(`Invalid attribute value at position ${match.index + 1}`);
    }
    if (key) {
      newNode.a[key] = dqValue ?? sqValue ?? key;
    }
  }
  return newNode;
}

/**
 * Validates the end tag.
 * @param current - The current node.
 * @param node - The node to validate.
 * @param end - The end tag.
 * @param lastIndex - The last index of the regex.
 * @returns The validated node.
 */
function validateEndTag(
  current: IntermediateTNode,
  node: TNode | undefined,
  end: string,
  lastIndex: number,
): IntermediateTNode {
  if (!node || typeof node === 'string') {
    throw new Error(
      `No opening tag for closing tag </${end}> at position ${lastIndex}`,
    );
  }
  if (current.t !== end) {
    throw new Error(
      `Tag mismatch: opened <${current.t}> but closed </${end}> at position ${lastIndex}`,
    );
  }
  return node;
}

/**
 * Processes a part of the template.
 * @param src - The source string.
 * @param re - The regex to use.
 * @param _current - The current node.
 * @param stack - The stack of nodes.
 * @returns The processed node.
 */
function parseTemplateProcPart(
  src: string,
  re: RegExp,
  _current: IntermediateTNode,
  stack: TNode[],
): IntermediateTNode {
  let current = _current;
  const result = re.exec(src);
  if (!result) {
    throw new Error(`Unexpected end of source at position ${re.lastIndex}`);
  }
  const [, cdata, end, start, attrs, oclose, text] = result;
  if (cdata != null) {
    current.c.push(cdata);
  } else if (end != null) {
    current = validateEndTag(current, stack.pop(), end, re.lastIndex);
  } else if (start != null && attrs != null) {
    const newNode = parseArguments(start, attrs);
    current.c.push(newNode);
    if (oclose === '') {
      stack.push(current);
      current = newNode;
    }
  } else if (text != null) {
    const trimmedText = text.trim();
    if (trimmedText) {
      current.c.push(trimmedText);
    }
  }
  return current;
}

/**
 * Processes the template.
 * @param src - The source string.
 * @param root - The root node.
 * @public
 */
function parseTemplateProc(src: string, root: IntermediateTNode): void {
  const re =
    /<!--.*?-->|<!\[CDATA\[(.*?)\]\]>|<\/([^>\s]+)\s*>|<([^>\s]+)([^>/]*)(\/?)>|([^<]+)/suy;
  let current = root;
  const stack: TNode[] = [];
  while (re.lastIndex < src.length) {
    current = parseTemplateProcPart(src, re, current, stack);
  }
  if (stack.length) {
    throw new Error(`Unexpected end of source: unclosed tag <${current.t}>`);
  }
}

/**
 * Parses the template string.
 * @param src - The template string.
 * @returns The parsed TNode.
 * @public
 */
export function parseTemplate(src: string): TNode {
  const root: IntermediateTNode = { t: 'root', a: {}, c: [] };
  parseTemplateProc(src, root);
  const firstNode = root.c.shift();
  if (!firstNode || root.c.length) {
    throw new Error('Create only one root element in your template');
  }
  return firstNode;
}

/**
 * Handles errors by calling the onerror method if available.
 * @param error - The error to handle.
 * @param thisObj - The object that may have an onerror method.
 */
function handleError(error: unknown, thisObj?: object): void {
  if (thisObj && 'onerror' in thisObj && isFunction(thisObj.onerror)) {
    thisObj.onerror(error);
  } else {
    throw error;
  }
}

/**
 * Wraps a function with error handling.
 * @param fn - The function to wrap.
 * @param thisObj - The object that may have an onerror method.
 * @returns The wrapped function.
 * @public
 */
export function wrapFunctionWithErrorHandling(
  fn: AnyFunction,
  thisObj?: object,
): AnyFunction {
  return (...args: unknown[]) => {
    try {
      const result = fn.apply(thisObj, args);
      if (isObject(result) && 'catch' in result && isFunction(result.catch)) {
        return result.catch((error: unknown) => {
          handleError(error, thisObj);
        });
      }
      return result;
    } catch (error) {
      handleError(error, thisObj);
    }
    return null;
  };
}

const eventFuncCache = createDictionary<AnyFunction>();

/**
 * Creates an event function from the given code.
 * @param code - The code for the function.
 * @param thisObj - The object that may have an onerror method.
 * @returns The created event function.
 * @public
 */
export function createEventFunction(
  code: string,
  thisObj?: object,
): AnyFunction {
  let fc = eventFuncCache[code];
  if (!fc) {
    try {
      fc = createFunction('event', `return (${code});`);
    } catch {
      fc = createFunction('event', code);
    }
    eventFuncCache[code] = fc;
  }
  return wrapFunctionWithErrorHandling(fc, thisObj);
}

/**
 * Merge classes and styles into components.
 * @param element - Element whose attributes are to be merged.
 * @param attrs - Attribute values passed in the constructor.
 * @public
 */
export function mergeStyles(element: HTMLElement, attrs: TAttributes): void {
  if (typeof attrs.class === 'string') {
    let pClass = (element.getAttribute('class') ?? '').trim();
    const cClass = attrs.class.trim();
    if (pClass !== '' && cClass !== '') {
      pClass += ' ';
    }
    element.setAttribute('class', pClass + cClass);
  }
  if (typeof attrs.style === 'string') {
    let pStyle = (element.getAttribute('style') ?? '').trim();
    const cStyle = attrs.style.trim();
    if (pStyle !== '' && cStyle !== '' && !pStyle.endsWith(';')) {
      pStyle += ';';
    }
    element.setAttribute('style', pStyle + cStyle);
  }
}

/**
 * Merges attributes into an element without merging styles.
 * @param element - The element to merge attributes into.
 * @param attrs - The attributes to merge.
 * @param thisObj - The object that may have event handlers.
 * @public
 */
export function mergeAttrsWithoutStyles(
  element: HTMLElement,
  attrs: TAttributes,
  thisObj?: object,
): void {
  for (const [name, value] of Object.entries(attrs)) {
    if (
      !(
        (thisObj != null && name === 'id') ||
        name === 'for' ||
        name === 'class' ||
        name === 'style'
      )
    ) {
      if (thisObj && name.startsWith('on')) {
        const fn = createEventFunction(value, thisObj);
        (element as unknown as Record<string, unknown>)[name] = fn;
      } else {
        element.setAttribute(name, value);
      }
    }
  }
}

/**
 * Merge attributes into components.
 * @param element - Element whose attributes are to be merged.
 * @param attrs - Attribute values passed in the constructor.
 * @param thisObj - TComponent instance.
 * @public
 */
export function mergeAttrs(
  element: HTMLElement,
  attrs: TAttributes,
  thisObj?: object,
): void {
  mergeAttrsWithoutStyles(element, attrs, thisObj);
  mergeStyles(element, attrs);
}

const idMap = new WeakMap<
  object,
  { id: Record<string, object>; for: Record<string, object> }
>();

/**
 * Registers an ID for the target object.
 * @param attrs - The attributes containing the ID.
 * @param target - The target object.
 * @param thisObj - The object to register the ID with.
 */
function registerId(
  attrs: TAttributes,
  target: object,
  thisObj?: object,
): void {
  if (!thisObj) {
    return;
  }
  const types = ['id', 'for'] as const;
  for (const type of types) {
    const id = attrs[type];
    if (id != null) {
      let idm = idMap.get(thisObj);
      if (!idm) {
        idm = {
          id: createDictionary<object>(),
          for: createDictionary<object>(),
        };
        idMap.set(thisObj, idm);
      }
      idm[type][id] = target;
    }
  }
}

/**
 * Gets an element by its ID.
 * @param thisObj - The object containing the ID map.
 * @param name - The ID of the element.
 * @returns The element with the given ID.
 * @public
 */
export function getElementById(thisObj: object, name: string): unknown {
  const idm = idMap.get(thisObj);
  return idm && idm.id[name];
}

/**
 * A dictionary of components to use.
 * @public
 */
export type TComponentUses = Record<string, ConstructorOf<object>>;

/**
 * Recursively builds an element from a TNode.
 * @param tNode - The TNode to build from.
 * @param thisObj - The object to associate with the element.
 * @param uses - The components to use.
 * @returns The built node.
 */
function buildElementRecur(
  tNode: TNode,
  thisObj?: object,
  uses?: TComponentUses,
): Node | null {
  // Text node
  if (typeof tNode === 'string') {
    return document.createTextNode(tNode);
  }
  const nodes = removeNull(
    tNode.c.map((childNode) => buildElementRecur(childNode, thisObj, uses)),
  );
  // Sub component
  const SubComponent = uses?.[tNode.t];
  if (SubComponent) {
    const attrs = { ...tNode.a };
    if ('id' in attrs) {
      delete attrs.id;
    }
    const obj = new SubComponent(attrs, nodes, thisObj);
    registerId(tNode.a, obj, thisObj);
    if ('element' in obj && obj.element instanceof Node) {
      return obj.element;
    }
    return null;
  }
  // Element
  const element = document.createElement(tNode.t);
  mergeAttrs(element, tNode.a, thisObj);
  for (const node of nodes) {
    element.appendChild(node);
  }
  registerId(tNode.a, element, thisObj);
  return element;
}

/**
 * Builds an element from a TNode.
 * @param tNode - The TNode to build from.
 * @param thisObj - The object to associate with the element.
 * @param uses - The components to use.
 * @returns The built HTMLElement.
 * @public
 */
export function buildElement(
  tNode: TNode,
  thisObj?: object,
  uses?: TComponentUses,
): HTMLElement {
  const node = buildElementRecur(tNode, thisObj, uses);
  if (!(node instanceof HTMLElement)) {
    throw new Error('The root node must be an HTMLElement.');
  }
  return node;
}

/**
 * Creates an element from an HTML string.
 * @param html - The HTML string.
 * @param thisObj - The object to associate with the element.
 * @param uses - The components to use.
 * @returns The created HTMLElement.
 * @public
 */
export function createElement(
  html: string,
  thisObj?: object,
  uses?: TComponentUses,
): HTMLElement {
  return buildElement(parseTemplate(html), thisObj, uses);
}

let globalIdCounter = 0;

/**
 * Binds a label element to a target element.
 * @param labelElem - The label element.
 * @param targetElem - The target element.
 * @public
 */
export function bindLabel(
  labelElem: HTMLLabelElement,
  targetElem: HTMLElement,
): void {
  let { id } = targetElem;
  if (!id) {
    globalIdCounter += 1;
    id = `t-component-global-id-${globalIdCounter}`;
    targetElem.id = id;
  }
  labelElem.htmlFor = id;
}

const nodeMap = new WeakMap<object, TComponent>();

/**
 * The base class for TComponent.
 * @public
 */
export class TComponent {
  static uses?: TComponentUses;
  static template = '<div></div>';
  static parsedTemplate?: TNode;
  readonly element: HTMLElement;
  parentComponent: TComponent | null = null;

  /**
   * Retrieves a TComponent instance from an element.
   * @param this - The TComponent constructor.
   * @param element - The element to retrieve the instance from.
   * @returns The TComponent instance or null.
   */
  static from<T extends typeof TComponent>(
    this: T,
    element: unknown,
  ): InstanceType<T> | null {
    if (!isObject(element)) return null;
    const component = nodeMap.get(element);
    if (!(component instanceof this)) return null;
    return component as InstanceType<T>;
  }

  /**
   * Creates an instance of TComponent.
   * @param attrs - The attributes for the component.
   * @param nodes - The child nodes for the component.
   * @param parent - The parent object.
   */
  constructor(attrs?: TAttributes, nodes?: Node[], parent?: object) {
    const SubComponent = this.constructor as typeof TComponent;
    if (
      !Object.hasOwn(SubComponent, 'parsedTemplate') ||
      !SubComponent.parsedTemplate
    ) {
      SubComponent.parsedTemplate = parseTemplate(SubComponent.template);
    }
    this.element = buildElement(
      SubComponent.parsedTemplate,
      this,
      SubComponent.uses,
    );

    if (attrs) {
      mergeAttrs(this.element, attrs, parent);
    }
    if (nodes) {
      for (const node of nodes) {
        this.element.appendChild(node);
      }
    }
    if (parent instanceof TComponent) {
      this.parentComponent = parent;
    }

    const idm = idMap.get(this);
    if (idm) {
      for (const key of Object.keys(idm.for)) {
        const labelElem = idm.for[key];
        const targetElem = idm.id[key];
        if (
          labelElem instanceof HTMLLabelElement &&
          targetElem instanceof HTMLElement
        ) {
          bindLabel(labelElem, targetElem);
        }
      }
    }

    if (!nodeMap.get(this.element)) nodeMap.set(this.element, this);
  }

  /**
   * Retrieves an element by its ID.
   * @param id - The ID of the element.
   * @returns The element with the given ID.
   */
  protected id(id: string): unknown;

  /**
   * Retrieves an element by its ID and checks its constructor.
   * @param id - The ID of the element.
   * @param constructor - The constructor to check.
   * @returns The element with the given ID.
   */
  protected id<T>(id: string, constructor: ConstructorOf<T>): T;

  protected id<T>(id: string, constructor?: ConstructorOf<T>): unknown {
    const element = getElementById(this, id);
    if (constructor && !(element instanceof constructor)) {
      throw new Error('Element is not an instance of the provided constructor');
    }
    return element;
  }

  /**
   * Handles errors by propagating them to the parent component or throwing them.
   * @param error - The error to handle.
   */
  onerror(error: unknown): void {
    if (this.parentComponent) {
      this.parentComponent.onerror(error);
    } else {
      throw error;
    }
  }
}

export default TComponent;
