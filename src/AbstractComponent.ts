import { createLinkedController } from './internal/signal';
import type { ComponentParams } from './types';

/**
 * The base class for all components.
 * Provides basic properties to manage the component hierarchy, attributes, and children.
 */
export abstract class AbstractComponent {
  /** The parent component instance, if any. */
  parent?: AbstractComponent;
  /** The root DOM Element of the component. */
  abstract element: Element;

  #controller?: AbortController;
  readonly #customSignal?: AbortSignal;

  /**
   * Creates an instance of `AbstractComponent`.
   *
   * @param params - The initialization parameters.
   */
  constructor(params?: ComponentParams) {
    this.parent = params?.parent;
    this.#customSignal = params?.signal;
  }

  /**
   * Lazily initializes and returns the AbortSignal for this component.
   * Automatically links to the parent's signal to form a cascade of teardowns.
   */
  get signal(): AbortSignal {
    if (!this.#controller) {
      this.#controller = createLinkedController(
        this.#customSignal,
        this.parent?.signal,
      );
    }
    return this.#controller.signal;
  }

  /**
   * Destroys the component.
   * Aborts the internal controller (unbinding events) and removes the element from the DOM.
   */
  destroy(): void {
    this.#controller?.abort();
    this.element.remove();
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
