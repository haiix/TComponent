import type { AbstractComponent } from '../AbstractComponent';

/**
 * Syntax of supported event handlers
 * Matches "method", "this.method", "method(event)", "return method()", " this . method ( event ) ; ", etc.,
 * and extracts the method name into Group 1.
 */
export const EVENT_HANDLER_REGEX =
  /^\s*(?:return\s+)?(?:this\s*\.\s*)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:\(\s*(?:event)?\s*\))?\s*;?\s*$/u;

/**
 * Represents an error handling boundary.
 * Any error thrown or rejected within a wrapped handler will be forwarded to `onerror`.
 */
export interface ErrorBoundary {
  onerror: (error: unknown) => void;
}

/**
 * Wraps a function and returns an event handler with centralized error handling.
 *
 * The provided `fn` is invoked with `thisArg` as its `this` context.
 * Any synchronous errors are caught and forwarded to `thisArg.onerror`.
 * If `fn` returns a Promise, rejected errors are also forwarded to `onerror`.
 *
 * Additionally, if `fn` returns `false`, `event.preventDefault()` is called,
 * mirroring common DOM event handler behavior.
 *
 * @param thisArg - The execution context for `fn`, and the error boundary that receives all errors.
 * @param methodName - The event handler method name to wrap. It may return `void`, `boolean`, or a `Promise`.
 * @returns A new event handler function with error forwarding and default prevention handling.
 */
export function createEventHandler(thisArg: ErrorBoundary, methodName: string) {
  return (event: Event): void => {
    try {
      const fn = (thisArg as ErrorBoundary & Record<string, unknown>)[
        methodName
      ];

      if (typeof fn !== 'function') {
        throw new TypeError(
          `Event handler "${methodName}" is not a function on the component.`,
        );
      }

      const result = fn.call(thisArg, event) as unknown;
      if (result instanceof Promise) {
        result.catch((error: unknown) => {
          thisArg.onerror(error);
        });
      } else if (result === false) {
        event.preventDefault();
      }
    } catch (error) {
      thisArg.onerror(error);
    }
  };
}

/**
 * Parses an event attribute and binds the corresponding method to the DOM element.
 *
 * @param element - The DOM element to attach the event listener to.
 * @param attrName - The event attribute name (e.g., 'onclick').
 * @param attrValue - The event attribute value containing the method name.
 * @param contextComponent - The component instance providing the method context.
 * @param signal - The AbortSignal to automatically unbind the listener.
 */
export function bindEvent(
  element: Element,
  attrName: string,
  attrValue: string,
  contextComponent: AbstractComponent,
  signal: AbortSignal,
): void {
  const match = EVENT_HANDLER_REGEX.exec(attrValue);
  const methodName = match?.[1];

  if (!methodName) {
    throw new Error(
      `SecurityError: Invalid event handler signature in attribute "${attrName}": "${attrValue}"`,
    );
  }
  if (methodName === 'constructor' || methodName === '__proto__') {
    throw new Error(`SecurityError: Access to "${methodName}" is forbidden.`);
  }

  const eventType = attrName.slice(2).toLowerCase();
  const wrappedFn = createEventHandler(contextComponent, methodName);

  element.addEventListener(eventType, wrappedFn, { signal });
}
