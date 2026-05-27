import { describe, it, expect, vi } from 'vitest';
import { createLinkedController } from '../../src/internal/signal';

describe('createLinkedController', () => {
  it('aborts the linked controller when any of the parent signals aborts', () => {
    const parentController1 = new AbortController();
    const parentController2 = new AbortController();
    const childController = createLinkedController(
      parentController1.signal,
      parentController2.signal,
    );

    expect(childController.signal.aborted).toBe(false);

    // When the first parent aborts, the child should also abort
    parentController1.abort();
    expect(childController.signal.aborted).toBe(true);
  });

  it('aborts immediately if any of the parent signals is already aborted', () => {
    const parentController1 = new AbortController();
    const parentController2 = new AbortController();
    parentController2.abort(); // Abort before creating the linked controller

    const childController = createLinkedController(
      parentController1.signal,
      parentController2.signal,
    );

    // It should instantly recognize the parent's aborted state
    expect(childController.signal.aborted).toBe(true);
  });

  it('removes the abort listener from all parent signals when the linked controller aborts first (prevents memory leaks)', () => {
    const parentController1 = new AbortController();
    const parentController2 = new AbortController();

    // Spy on the parent's removeEventListener to ensure cleanup happens
    const removeEventListenerSpy1 = vi.spyOn(
      parentController1.signal,
      'removeEventListener',
    );
    const removeEventListenerSpy2 = vi.spyOn(
      parentController2.signal,
      'removeEventListener',
    );

    const childController = createLinkedController(
      parentController1.signal,
      parentController2.signal,
    );

    // The child aborts independently (e.g., a component is manually destroyed)
    childController.abort();

    // It must clean up its own listener from all long-lived parent signals
    expect(removeEventListenerSpy1).toHaveBeenCalledTimes(1);
    expect(removeEventListenerSpy1).toHaveBeenCalledWith(
      'abort',
      expect.any(Function),
    );
    expect(removeEventListenerSpy2).toHaveBeenCalledTimes(1);
    expect(removeEventListenerSpy2).toHaveBeenCalledWith(
      'abort',
      expect.any(Function),
    );
  });
});
