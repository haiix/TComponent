import type { ParseOptions, TNode, ComponentParams } from './types';
import { AbstractComponent } from './AbstractComponent';
import { BuildContext } from './BuildContext';
import { parseTemplate } from './parse';

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

  /** The context object for the build process. */
  readonly context: BuildContext;
  /** The root DOM Element of the component. */
  readonly element: T;

  /** A map of original template IDs to uniquely generated DOM elements. */
  get idMap(): IDMap {
    return this.context.idMap as IDMap;
  }

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

    this.context = new BuildContext(this, Component.parsedUses, params.signal);
    this.element = this.context.build(Component.parsedTemplate) as T;
    this.context.resolveIdReferences();
  }
}

export default TComponent;
