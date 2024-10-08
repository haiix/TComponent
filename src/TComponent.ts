/*
 * TComponent.ts
 *
 * Copyright (c) 2024 haiix
 *
 * This module is released under the MIT license:
 * https://opensource.org/licenses/MIT
 */

export const version = '1.1.0';

export type TAttributes = Record<string, string>;

export type TNode =
  | string
  | {
      t: string;
      a: TAttributes;
      c: TNode[];
    };

export function parseTemplate(src: string): TNode {
  const re =
    /<!--.*?-->|<!\[CDATA\[(.*?)\]\]>|<\/([^>\s]+)\s*>|<([^>\s]+)([^>/]*)(\/?)>|([^<]+)/sy;
  const root: TNode = { t: 'root', a: {}, c: [] };
  let current = root;
  const stack: TNode[] = [];
  while (re.lastIndex < src.length) {
    const result = re.exec(src);
    if (result == null) {
      throw new Error(`Unexpected end of source at position ${re.lastIndex}`);
    }
    const [, cdata, end, start, attrs, oclose, text] = result;
    if (cdata != null) {
      current.c.push(cdata);
    } else if (end != null) {
      const temp = stack.pop();
      if (!temp || typeof temp === 'string') {
        throw new Error(
          `No opening tag for closing tag </${end}> at position ${re.lastIndex}`,
        );
      }
      if (current.t !== end) {
        throw new Error(
          `Tag mismatch: opened <${current.t}> but closed </${end}> at position ${re.lastIndex}`,
        );
      }
      current = temp;
    } else if (start != null && attrs != null) {
      const newNode: TNode = { t: start, a: {}, c: [] };
      const trimmedAttrs = attrs.trimEnd();
      const attrRe = /\s+([^\s=>]+)(="[^"]*"|='[^']*')?/sy;
      while (attrRe.lastIndex < trimmedAttrs.length) {
        const attr = attrRe.exec(trimmedAttrs);
        if (attr == null) {
          throw new Error(
            `Invalid attribute format at position ${attrRe.lastIndex}`,
          );
        }
        const [, key, value] = attr;
        if (key != null) {
          newNode.a[key] = value == null ? key : value.slice(2, -1);
        }
      }
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
  }
  if (stack.length !== 0) {
    throw new Error(`Unexpected end of source: unclosed tag <${current.t}>`);
  }
  const nodes = root.c;
  if (nodes[0] == null || nodes.length > 1)
    throw new Error('Create only one root element in your template');
  return nodes[0];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Constructable = new (...args: any[]) => object;
/* eslint-enable @typescript-eslint/no-explicit-any */

export function removeUndefined<T>(arr: (T | undefined | null)[]): T[] {
  return arr.filter((value): value is T => value != null);
}

export function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function handleError(error: unknown, thisObj?: object): void {
  if (
    thisObj &&
    'onerror' in thisObj &&
    typeof thisObj.onerror === 'function'
  ) {
    thisObj.onerror(error);
  } else {
    throw error;
  }
}

export function handleFunctionError(
  fn: unknown,
  thisObj?: object,
): (...args: unknown[]) => unknown {
  if (typeof fn !== 'function') {
    throw new Error();
  }
  return (...args: unknown[]): unknown => {
    try {
      const result: unknown = fn.apply(thisObj, args);
      if (
        isObject(result) &&
        'catch' in result &&
        typeof result.catch === 'function'
      ) {
        return result.catch((error: unknown): void => {
          handleError(error, thisObj);
        });
      } else {
        return result;
      }
    } catch (error) {
      handleError(error, thisObj);
    }
  };
}

const eventFuncCache: Record<string, unknown> = {};
export function createEventFunction(
  code: string = '',
  thisObj?: object,
): (event?: unknown) => unknown {
  let fc = eventFuncCache[code];
  if (!fc) {
    try {
      fc = new Function('event', `return (${code});`);
    } catch {
      fc = new Function('event', code);
    }
    eventFuncCache[code] = fc;
  }
  return handleFunctionError(fc, thisObj);
}

/**
 * Merge classes and styles into components.
 * @param element - Element whose attributes are to be merged.
 * @param attrs - Attribute values passed in the constructor.
 */
export function mergeStyles(element: HTMLElement, attrs: TAttributes): void {
  if (typeof attrs.class === 'string') {
    let pClass = (element.getAttribute('class') ?? '').trim();
    const cClass = attrs.class.trim();
    if (pClass !== '' && cClass !== '') pClass += ' ';
    element.setAttribute('class', pClass + cClass);
  }
  if (typeof attrs.style === 'string') {
    let pStyle = (element.getAttribute('style') ?? '').trim();
    const cStyle = attrs.style.trim();
    if (pStyle !== '' && cStyle !== '' && !pStyle.endsWith(';')) pStyle += ';';
    element.setAttribute('style', pStyle + cStyle);
  }
}

export function mergeAttrsWithoutStyles(
  element: HTMLElement,
  attrs: TAttributes,
  thisObj?: object,
): void {
  for (const [name, value] of Object.entries(attrs)) {
    if (typeof value !== 'string') continue;
    if (
      !(
        (thisObj && name === 'id') ||
        name === 'for' ||
        name === 'class' ||
        name === 'style'
      )
    ) {
      if (thisObj && name.startsWith('on')) {
        const fn = createEventFunction(value, thisObj);
        element.addEventListener(name.slice(2), fn);
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
 */
export function mergeAttrs(
  element: HTMLElement,
  attrs: TAttributes,
  thisObj?: object,
): void {
  mergeAttrsWithoutStyles(element, attrs, thisObj);
  mergeStyles(element, attrs);
}

const idMap: WeakMap<
  object,
  { id: Record<string, object>; for: Record<string, object> }
> = new WeakMap();
function registerId(
  attrs: TAttributes,
  target: object,
  thisObj?: object,
): void {
  if (!thisObj) return;
  const types: ['id', 'for'] = ['id', 'for'];
  for (const type of types) {
    const id = attrs[type];
    if (id == null) continue;
    let idm = idMap.get(thisObj);
    if (!idm) {
      idm = { id: Object.create(null), for: Object.create(null) };
      idMap.set(thisObj, idm);
    }
    idm[type][id] = target;
  }
}
export function getElementById(thisObj: object, name: string): unknown {
  const idm = idMap.get(thisObj);
  return idm && idm['id'][name];
}

export type TComponentUses = Record<string, Constructable>;

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

function buildElementRecur(
  tNode: TNode,
  thisObj?: object,
  uses?: TComponentUses,
): Node | undefined {
  // Text node
  if (typeof tNode === 'string') {
    return document.createTextNode(tNode);
  }
  const nodes = removeUndefined(
    tNode.c.map((tNode) => buildElementRecur(tNode, thisObj, uses)),
  );
  // Sub component
  const SubComponent = uses?.[tNode.t];
  if (SubComponent) {
    const attrs = { ...tNode.a };
    if ('id' in attrs) delete attrs.id;
    const obj = new SubComponent(attrs, nodes, thisObj);
    registerId(tNode.a, obj, thisObj);
    return 'element' in obj && obj.element instanceof Node
      ? obj.element
      : undefined;
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

export function createElement(
  html: string,
  thisObj?: object,
  uses?: TComponentUses,
): HTMLElement {
  return buildElement(parseTemplate(html), thisObj, uses);
}

let globalIdCounter = 0;
export function bindLabel(
  labelElem: HTMLLabelElement,
  targetElem: HTMLElement,
): void {
  let id = targetElem.id;
  if (!id) {
    id = 't-component-global-id-' + ++globalIdCounter;
    targetElem.id = id;
  }
  labelElem.htmlFor = id;
}

export class TComponent {
  static uses?: TComponentUses;
  static template = '<div></div>';
  static parsedTemplate?: TNode;
  readonly element: HTMLElement;
  readonly parentComponent?: TComponent;

  constructor(attrs?: TAttributes, nodes?: Node[], parent?: object) {
    const SubComponent = this.constructor as typeof TComponent;
    //if (!Object.hasOwn(SubComponent, "parsedTemplate")) { // ES2022
    if (!Object.hasOwnProperty.call(SubComponent, 'parsedTemplate')) {
      SubComponent.parsedTemplate = parseTemplate(SubComponent.template);
    }
    this.element = buildElement(
      SubComponent.parsedTemplate as TNode,
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
      for (const key in idm.for) {
        const labelElem = idm.for[key];
        const targetElem = idm.id[key];
        // TODO: Support HTMLOutputElement
        if (
          labelElem instanceof HTMLLabelElement &&
          targetElem instanceof HTMLElement
        ) {
          bindLabel(labelElem, targetElem);
        }
      }
    }
  }

  protected id(name: string): unknown {
    return getElementById(this, name);
  }

  onerror(error: unknown): void {
    if (this.parentComponent) {
      this.parentComponent.onerror(error);
    } else {
      throw error;
    }
  }
}

export default TComponent;
