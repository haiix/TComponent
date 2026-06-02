import { describe, it, expect, vi } from 'vitest';
import { createLinkedController } from '../../src/internal/signal';

describe('createLinkedController', () => {
  it('aborts the linked controller when the parent signal aborts', () => {
    const parentController = new AbortController();

    const childController = createLinkedController(parentController.signal);

    expect(childController.signal.aborted).toBe(false);

    parentController.abort();

    expect(childController.signal.aborted).toBe(true);
  });

  it('aborts immediately if the parent signal is already aborted', () => {
    const parentController = new AbortController();
    parentController.abort(); // Abort before creating the linked controller

    const childController = createLinkedController(parentController.signal);

    expect(childController.signal.aborted).toBe(true);
  });

  it('removes the abort listener from the parent signal when the linked controller aborts first (prevents memory leaks)', () => {
    const parentController = new AbortController();

    const removeEventListenerSpy = vi.spyOn(
      parentController.signal,
      'removeEventListener',
    );

    const childController = createLinkedController(parentController.signal);

    // The child aborts independently
    childController.abort();

    expect(removeEventListenerSpy).toHaveBeenCalledTimes(1);
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'abort',
      expect.any(Function),
    );
  });

  it('propagates the abort reason from the parent signal', () => {
    const parentController = new AbortController();

    const childController = createLinkedController(parentController.signal);

    parentController.abort('parent reason');

    expect(childController.signal.aborted).toBe(true);
    expect(childController.signal.reason).toBe('parent reason');
  });
});
