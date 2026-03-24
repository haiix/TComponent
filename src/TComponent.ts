import type {
  AbstractConstructor,
  ComponentParams,
  ParseOptions,
  ParsedComponent,
} from './types';
import { AbstractComponent } from './AbstractComponent';
import { BuildContext } from './BuildContext';
import { parseTemplate } from './parse';

/**
 * Global registry mapping root DOM elements to their respective TComponent instances.
 * Using a WeakMap ensures that components are garbage-collected when their DOM elements are removed.
 */
const componentRegistry = new WeakMap<Element, TComponent>();

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

  /** The parsed AST (`TNode`) of the HTML template and Lowercased uses. Cached across instances. */
  private static _parsed?: ParsedComponent;

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

    this.context = new BuildContext(this, parsed.uses, params.signal);
    this.element = this.context.build(parsed.template) as T;
    this.context.resolveIdReferences();

    componentRegistry.set(this.element, this as TComponent);
  }

  /**
   * Destroys the component.
   * Automatically removes the element from the DOM and cleans up all associated event listeners.
   */
  destroy(): void {
    this.context.controller.abort();
    this.element.remove();
  }

  /**
   * Retrieves the component instance associated with the given DOM element.
   * Only returns the instance if it matches the calling class type.
   *
   * @param element - The root DOM element of the component.
   * @returns The component instance, or undefined if not found or type mismatch.
   */
  static from<C extends TComponent>(
    this: AbstractConstructor<C>,
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

  /** A map of original template IDs to uniquely generated DOM elements. */
  get idMap(): IDMap {
    return this.context.idMap as IDMap;
  }

  /**
   * Retrieves the class-specific parsed templates and dependent components (uses).
   * If they have not been parsed, parses them and saves them to the cache.
   */
  static getParsed(): ParsedComponent {
    if (!Object.hasOwn(this, '_parsed') || !this._parsed) {
      const parseOptions = Object.hasOwn(this, 'parseOptions')
        ? this.parseOptions
        : {};

      this._parsed = {
        template: parseTemplate(this.template, parseOptions),
        uses: Object.fromEntries(
          Object.entries(this.uses).map(([name, Component]) => [
            name.toLowerCase(),
            Component,
          ]),
        ),
      };
    }
    return this._parsed;
  }
}

export default TComponent;
