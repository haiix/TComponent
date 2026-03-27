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
 * @param fn - The event handler function to wrap. It may return `void`, `boolean`, or a `Promise`.
 * @returns A new event handler function with error forwarding and default prevention handling.
 */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */
export function createEventHandler(thisArg: ErrorBoundary, fn: Function) {
  /* eslint-enable @typescript-eslint/no-unsafe-function-type */
  return (event: Event): void => {
    try {
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
