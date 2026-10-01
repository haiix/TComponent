import type { ComponentParams } from './types';
import {
  createLinkedController,
  lifecycleSignal,
  type ScopedComponentParams,
} from './internal/signal';
import { throwError } from './internal/messages';

/**
 * The base class for all components.
 * Provides basic properties to manage the component hierarchy, attributes, and children.
 */
export abstract class AbstractComponent {
  /** The parent component instance, if any. */
  readonly parent?: AbstractComponent;
  /** The root DOM Element of the component. */
  abstract element: Element;

  #controller?: AbortController;
  #destroyed = false;
  readonly #signal?: AbortSignal;

  /**
   * Creates an instance of `AbstractComponent`.
   *
   * @param params - The initialization parameters.
   */
  constructor(params?: ComponentParams) {
    if (params?.parent && params.signal) {
      throwError(
        'Cannot provide a signal when a parent component is already set.',
      );
    }
    this.parent = params?.parent;
    const scopedParams: ScopedComponentParams | undefined = params;
    this.#signal = scopedParams?.[lifecycleSignal] ?? params?.signal;
  }

  /**
   * Lazily initializes and returns the AbortSignal for this component.
   * Automatically links to the lifecycle owner's signal to form a cascade of teardowns.
   * For slotted components, the lifecycle owner is the component receiving the slot.
   */
  get signal(): AbortSignal {
    if (!this.#controller) {
      if (this.#destroyed) {
        this.#controller = new AbortController();
        this.#controller.abort();
      } else {
        this.#controller = createLinkedController(
          this.#signal ?? this.parent?.signal,
        );
      }
    }
    return this.#controller.signal;
  }

  /**
   * Destroys the component.
   * Aborts the internal controller (unbinding events) and removes the element from the DOM.
   */
  destroy(): void {
    this.#destroyed = true;
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
