/**
 * Creates a new AbortController that is automatically linked to one or more parent AbortSignals.
 * If any of the parent signals abort, the newly created controller will also abort.
 * It automatically handles garbage collection by unbinding when the child aborts first.
 *
 * @param signals - The optional parent AbortSignals to link to.
 * @returns A newly created and linked AbortController.
 */
export function createLinkedController(
  ...signals: (AbortSignal | undefined)[]
): AbortController {
  const controller = new AbortController();
  const validSignals = signals.filter((s): s is AbortSignal => s != null);

  if (validSignals.length === 0) {
    return controller;
  }

  // If any parent signal is already aborted, abort immediately
  const abortedSignal = validSignals.find((s) => s.aborted);
  if (abortedSignal) {
    controller.abort(abortedSignal.reason);
    return controller;
  }

  const onParentAbort = (event: Event): void => {
    const target = event.target as AbortSignal;
    controller.abort(target.reason);
  };

  for (const signal of validSignals) {
    signal.addEventListener('abort', onParentAbort, { once: true });
  }

  // If the child aborts first, remove the listener from all parents
  // to ensure proper Garbage Collection (GC) and prevent memory leaks.
  controller.signal.addEventListener(
    'abort',
    (): void => {
      for (const signal of validSignals) {
        signal.removeEventListener('abort', onParentAbort);
      }
    },
    { once: true },
  );

  return controller;
}
