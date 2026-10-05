import type { AbstractComponent } from './AbstractComponent';

/**
 * Represents the constructor type of a class.
 *
 * @typeParam T - The instance type created by the constructor.
 */
export type ConstructorOf<T> = abstract new (
  /* eslint-disable @typescript-eslint/no-explicit-any */
  ...args: any[]
  /* eslint-enable @typescript-eslint/no-explicit-any */
) => T;

/**
 * Options required for template parsing.
 */
export interface ParseOptions {
  /**
   * Preserve text nodes that consist only of newline whitespace.
   * When false, newline-only whitespace between elements is removed.
   * @defaultValue false
   */
  preserveWhitespace?: boolean;
}

/**
 * Represents a read-only Abstract Syntax Tree (AST) node for DOM construction,
 * with tag and attribute names in the same form as HTML parser output.
 * `parseTemplate()` copies names from the browser's HTML parser; the library does
 * not independently normalize them. Manually created nodes and modified copies
 * must maintain the same name format for the namespace being built.
 * `BuildContext` reads these names without providing HTML-style case correction.
 *
 * Templates cached by `TComponent.getParsed()` are recursively frozen at runtime.
 */
export interface TNode {
  /**
   * The element's local name. Use lowercase for HTML (e.g. `button`) and the
   * correct case for SVG, MathML, or XML (e.g. `linearGradient`, `foreignObject`).
   * Do not lowercase case-sensitive names when creating or modifying nodes.
   */
  readonly t: string;
  /**
   * A dictionary of the element's attributes. Use lowercase HTML names such as
   * `id`, `onclick`, and `aria-labelledby`. For SVG, MathML, or XML, use the
   * correct case for the namespace (e.g. SVG `viewBox`). These requirements also
   * apply to modified copies; DOM attribute assignment does not retroactively
   * trigger ID registration or event binding for incorrectly cased names.
   */
  readonly a: Readonly<Record<string, string>>;
  /** An array of child nodes, which can be either `TNode` objects or plain text strings. */
  readonly c: readonly (TNode | string)[];
}

/**
 * Parameters required to initialize a component.
 */
export interface ComponentParams {
  /** The parent component instance, if any. */
  parent?: AbstractComponent;
  /** Read-only template attributes. Copy before modifying. */
  readonly attributes?: Readonly<Record<string, string>>;
  /** Read-only template child nodes. Copy nested nodes before modifying them. */
  readonly childNodes?: readonly (TNode | string)[];
  /** An `AbortSignal` used to manage event listeners and component teardown. */
  signal?: AbortSignal;
}

/**
 * The default type for idMap.
 * It allows mapping strings to any DOM Element or AbstractComponent instance.
 */
export type DefaultIDMap = Record<string, Element | AbstractComponent>;

/**
 * The read-only cache of parsed templates and subcomponents.
 * `TComponent.getParsed()` freezes this object and uses dictionary, and recursively freezes the template.
 */
export interface ParsedTemplateData {
  readonly template: TNode;
  readonly ns?: string;
  readonly uses: Readonly<Record<string, typeof AbstractComponent>>;
}

/**
 * Represents an entry for an ID reference that needs to be resolved after the element is built.
 */
export interface IDReferenceEntry {
  /** The attribute name to resolve (e.g. "for", "href", "fill") */
  attrName: string;
  /** The original attribute value (ID list, fragment, or SVG URL reference) */
  refId: string;
  /** The DOM element that holds the reference */
  element: Element;
}
