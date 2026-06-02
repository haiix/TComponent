/**
 * Creates a new AbortController that is automatically linked to a parent AbortSignal.
 * If the parent signal aborts, the newly created controller will also abort.
 * It automatically handles garbage collection by unbinding when the child aborts first.
 *
 * @param signal - The optional parent AbortSignal to link to.
 * @returns A newly created and linked AbortController.
 */
export function createLinkedController(signal?: AbortSignal): AbortController {
  const controller = new AbortController();
  if (!signal) {
    return controller;
  }

  if (signal.aborted) {
    controller.abort(signal.reason);
    return controller;
  }

  const onParentAbort = (): void => {
    controller.abort(signal.reason);
  };

  signal.addEventListener('abort', onParentAbort, { once: true });

  // If the child aborts first, remove the listener from the parent
  // to ensure proper Garbage Collection (GC) and prevent memory leaks.
  controller.signal.addEventListener(
    'abort',
    (): void => {
      signal.removeEventListener('abort', onParentAbort);
    },
    { once: true },
  );

  return controller;
}
