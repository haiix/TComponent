import { describe, it, expect, vi } from 'vitest';
import { createLinkedController } from '../../src/internal/signal';

describe('createLinkedController', () => {
  it('aborts the linked controller when the parent signal aborts', () => {
    const parentController = new AbortController();
    const childController = createLinkedController(parentController.signal);

    expect(childController.signal.aborted).toBe(false);

    // When the parent aborts, the child should also abort
    parentController.abort();
    expect(childController.signal.aborted).toBe(true);
  });

  it('aborts immediately if the parent signal is already aborted', () => {
    const parentController = new AbortController();
    parentController.abort(); // Abort before creating the linked controller

    const childController = createLinkedController(parentController.signal);

    // It should instantly recognize the parent's aborted state
    expect(childController.signal.aborted).toBe(true);
  });

  it('removes the abort listener from the parent signal when the linked controller aborts first (prevents memory leaks)', () => {
    const parentController = new AbortController();

    // Spy on the parent's removeEventListener to ensure cleanup happens
    const removeEventListenerSpy = vi.spyOn(
      parentController.signal,
      'removeEventListener',
    );

    const childController = createLinkedController(parentController.signal);

    // The child aborts independently (e.g., a component is manually destroyed)
    childController.abort();

    // It must clean up its own listener from the long-lived parent signal
    expect(removeEventListenerSpy).toHaveBeenCalledTimes(1);
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'abort',
      expect.any(Function),
    );
  });
});
