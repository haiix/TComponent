/**
 * Creates a new AbortController that is automatically linked to a parent's AbortSignal.
 * If the parent aborts, the newly created controller will also abort.
 * It automatically handles garbage collection by unbinding when the child aborts first.
 *
 * @param parentSignal - The optional parent AbortSignal to link to.
 * @returns A newly created and linked AbortController.
 */
export function createLinkedController(
  parentSignal?: AbortSignal,
): AbortController {
  const controller = new AbortController();

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort(parentSignal.reason);
    } else {
      const onParentAbort = (): void => {
        controller.abort(parentSignal.reason);
      };

      parentSignal.addEventListener('abort', onParentAbort, { once: true });

      // If the child aborts first, remove the listener from the parent
      // to ensure proper Garbage Collection (GC) and prevent memory leaks.
      controller.signal.addEventListener(
        'abort',
        (): void => {
          parentSignal.removeEventListener('abort', onParentAbort);
        },
        { once: true },
      );
    }
  }

  return controller;
}
