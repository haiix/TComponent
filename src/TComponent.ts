import type {
  ConstructorOf,
  ComponentParams,
  DefaultIDMap,
  ParseOptions,
  ParsedTemplateData,
} from './types';
import { AbstractComponent } from './AbstractComponent';
import { BuildContext } from './BuildContext';
import { parseTemplate } from './utils/parse';

/**
 * Global registry mapping root DOM elements to their respective TComponent instances.
 * Using a WeakMap ensures that components are garbage-collected when their DOM elements are removed.
 */
const componentRegistry = new WeakMap<Element, TComponent>();

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
    this.element = this.context.build(parsed.template, parsed.ns) as T;
    this.context.resolveIdReferences();

    componentRegistry.set(this.element, this as TComponent);
  }

  /**
   * Retrieves an internal element or sub-component by its original template ID.
   * Leverages the IDMap generic for strict type inference.
   *
   * @param id - The original ID defined in the static template.
   * @returns The element, strongly typed based on the IDMap.
   */
  getById<K extends keyof IDMap>(id: K): IDMap[K];

  /**
   * Retrieves an internal element or sub-component by its original template ID,
   * and asserts its type at runtime.
   *
   * @param id - The original ID defined in the static template.
   * @param ExpectedType - The expected class (e.g., HTMLInputElement, ChildComponent).
   * @returns The element, strongly typed to the ExpectedType.
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
    const el = this.context.idMap[id as string];

    if (!el) {
      throw new Error(
        `[TComponent] Element with id "${String(id)}" not found.`,
      );
    }

    if (ExpectedType && !(el instanceof ExpectedType)) {
      throw new TypeError(
        `[TComponent] Element "${String(id)}" is not an instance of ${ExpectedType.name}`,
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
  static from<C extends TComponent>(
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

      if (template.t in uses) {
        throw new Error(
          `[TComponent] ParseError: The root element of a template cannot be a custom component ("<${template.t}>"). ` +
            `To extend or alter a component's root behavior, use class inheritance (extends) instead of composition.`,
        );
      }

      this._parsed = { template, ns: this.namespaceURI, uses };
    }
    return this._parsed;
  }
}
