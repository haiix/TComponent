import type {
  ComponentParams,
  ConstructorOf,
  DefaultIDMap,
  ParseOptions,
  ParsedTemplateData,
} from './types';
import { AbstractComponent } from './AbstractComponent';
import { BuildContext } from './BuildContext';
import { parseTemplate } from './utils/parse';
import { throwError } from './internal/messages';
import { abortLifecycle } from './internal/signal';
import { freezeTemplate } from './internal/template';

/**
 * Global registry mapping root DOM elements to their respective TComponent instances.
 * The WeakMap does not itself keep otherwise unreachable elements and components alive.
 */
const componentRegistry = new WeakMap<Element, TComponent<Element, unknown>>();

/**
 * A practical base component class that automatically parses its template,
 * builds its DOM, binds events, and resolves sub-components.
 *
 * @typeParam T - The type of the root DOM Element.
 * @typeParam IDMap - Defines the exact shape of the idMap.
 */
export class TComponent<
  T extends Element = Element,
  IDMap = DefaultIDMap,
> extends AbstractComponent {
  /** A dictionary of custom components to be used within the template. */
  static uses: Record<string, typeof AbstractComponent> = {};
  /** The HTML string template for the component. */
  static template = '<div></div>';
  /** The namespace URI of this component's root element. */
  static namespaceURI?: string;
  /** The options passed when parsing the template. */
  static parseOptions?: ParseOptions;

  /** The parsed AST (`TNode`) of the HTML template and Lowercased uses. Cached across instances. */
  private static _parsed?: ParsedTemplateData;

  /** The context object for the build process. */
  readonly context: BuildContext;
  /** The root DOM Element of the component. */
  readonly element: T;

  /**
   * Creates an instance of `TComponent`.
   *
   * @param params - The initialization parameters.
   */
  constructor(params: ComponentParams = {}) {
    super(params);

    const Component = this.constructor as typeof TComponent;
    const parsed = Component.getParsed();

    this.context = new BuildContext(this, parsed.uses);
    try {
      this.element = this.context.build(parsed.template, parsed.ns) as T;
      this.context.resolveIdReferences();
    } catch (error) {
      this[abortLifecycle]();
      throw error;
    }

    componentRegistry.set(this.element, this);
  }

  /**
   * Retrieves an internal element or sub-component by its original template ID.
   * Leverages the IDMap generic for strict type inference.
   * Returns registered targets even after DOM removal or component destruction.
   *
   * @param id - The original ID defined in the static template.
   * @returns The element, strongly typed based on the IDMap.
   * @throws Error if the ID is unregistered; optional chaining does not suppress this error.
   */
  getById<K extends keyof IDMap>(id: K): IDMap[K];

  /**
   * Retrieves an internal element or sub-component by its original template ID,
   * and asserts its type at runtime.
   * Returns registered targets even after DOM removal or component destruction.
   *
   * @param id - The original ID defined in the static template.
   * @param ExpectedType - The expected class (e.g., HTMLInputElement, ChildComponent).
   * @returns The element, strongly typed to the ExpectedType.
   * @throws Error if the ID is unregistered; optional chaining does not suppress this error.
   * @throws TypeError if the registered target does not match the expected class.
   */
  getById<
    /* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */
    K extends keyof IDMap,
    /* eslint-enable @typescript-eslint/no-unnecessary-type-parameters */
    E extends Element | AbstractComponent,
  >(id: K, ExpectedType: ConstructorOf<E>): E;

  // Actual implementation
  getById<K extends keyof IDMap, E extends Element | AbstractComponent>(
    id: K,
    ExpectedType?: ConstructorOf<E>,
  ): IDMap[K] | E {
    const el =
      this.context.idMap[id as string] ??
      throwError(`Element with id "${String(id)}" not found.`);

    if (ExpectedType && !(el instanceof ExpectedType)) {
      throwError(
        `Element "${String(id)}" is not an instance of ${ExpectedType.name}`,
        TypeError,
      );
    }

    return el as IDMap[K] | E;
  }

  /**
   * Retrieves the component instance associated with the given DOM element.
   * Only returns the instance if it matches the calling class type.
   *
   * @param element - The root DOM element of the component.
   * @returns The component instance, or undefined if not found or type mismatch.
   */
  static from(
    this: typeof TComponent,
    element: Element | null | undefined,
  ): TComponent | undefined;
  static from<C extends TComponent<Element, unknown>>(
    this: ConstructorOf<C>,
    element: Element | null | undefined,
  ): C | undefined;
  static from<C extends TComponent<Element, unknown>>(
    this: ConstructorOf<C>,
    element: Element | null | undefined,
  ): C | undefined {
    if (element) {
      const component = componentRegistry.get(element);

      // Ensure the retrieved component is an instance of the class that called `.from()`
      if (component instanceof this) {
        return component;
      }
    }
  }

  /**
   * Retrieves the class-specific parsed templates and their dependent components (uses).
   * If they have not been parsed yet, parses them and caches the results.
   * The cache and uses dictionary are frozen; the template is recursively frozen.
   * Registered component classes remain mutable.
   *
   * @returns The parsed templates and their dependencies.
   */
  static getParsed(): ParsedTemplateData {
    if (!Object.hasOwn(this, '_parsed') || !this._parsed) {
      const parseOptions = this.parseOptions ?? {};

      const template = parseTemplate(this.template, parseOptions);
      const uses = Object.fromEntries(
        Object.entries(this.uses).map(([name, Component]) => [
          name.toLowerCase(),
          Component,
        ]),
      );

      if (Object.hasOwn(uses, template.t.toLowerCase())) {
        throwError(
          `ParseError: The root element of a template cannot be a custom component ("<${template.t}>"). ` +
            `To extend or alter a component's root behavior, use class inheritance (extends) instead of composition.`,
        );
      }

      freezeTemplate(template);
      this._parsed = Object.freeze({
        template,
        ns: this.namespaceURI,
        uses: Object.freeze(uses),
      });
    }
    return this._parsed;
  }
}
