import type { ComponentParams } from './types';

/**
 * The base class for all components.
 * Provides basic properties to manage the component hierarchy, attributes, and children.
 */
export class AbstractComponent {
  /** The parent component instance, if any. */
  parent?: AbstractComponent;
  /** The root DOM Element of the component. */
  element?: Element;

  /**
   * Creates an instance of `AbstractComponent`.
   *
   * @param params - The initialization parameters.
   */
  constructor(params?: ComponentParams) {
    this.parent = params?.parent;
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
