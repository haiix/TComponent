import type { AbstractComponent } from './AbstractComponent';

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
 * The interface that aggregates the parsing results of templates and subcomponents.
 */
export interface ParsedComponent {
  template: TNode;
  uses: Record<string, typeof AbstractComponent>;
}
