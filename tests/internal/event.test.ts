import { describe, it, expect, vi } from 'vitest';
import {
  createEventHandler,
  EVENT_HANDLER_REGEX,
} from '../../src/internal/event';

describe('createEventHandler', () => {
  it('executes the wrapped function with the correct this context and event', () => {
    const mockFn = vi.fn();
    const thisArg = { onerror: vi.fn() };
    const handler = createEventHandler(thisArg, mockFn);

    const event = new Event('click');
    handler(event);

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn.mock.contexts[0]).toBe(thisArg);
    expect(mockFn).toHaveBeenCalledWith(event);
  });

  it('calls event.preventDefault() when the handler returns exactly false', () => {
    const thisArg = { onerror: vi.fn() };
    const handler = createEventHandler(thisArg, () => false);

    const event = new Event('click', { cancelable: true });
    handler(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('catches synchronous errors and forwards them to thisArg.onerror', () => {
    const thisArg = { onerror: vi.fn() };
    const handler = createEventHandler(thisArg, () => {
      throw new Error('Sync Error');
    });

    handler(new Event('click'));

    expect(thisArg.onerror).toHaveBeenCalledTimes(1);
    expect(thisArg.onerror).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Sync Error' }),
    );
  });

  it('catches asynchronous promise rejections and forwards them to thisArg.onerror', async () => {
    const thisArg = { onerror: vi.fn() };
    const handler = createEventHandler(thisArg, async () => {
      throw new Error('Async Error');
    });

    handler(new Event('click'));
    await Promise.resolve(); // Wait for the microtask queue

    expect(thisArg.onerror).toHaveBeenCalledTimes(1);
    expect(thisArg.onerror).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Async Error' }),
    );
  });
});

describe('EVENT_HANDLER_REGEX', () => {
  it('extracts the method name from valid handler syntaxes', () => {
    const validSyntaxes = [
      'handleClick',
      'this.handleClick',
      'handleClick(event)',
      'return handleClick()',
      'return this.handleClick(event);',
      '  this . handleClick ( event ) ; ',
    ];

    for (const syntax of validSyntaxes) {
      const match = EVENT_HANDLER_REGEX.exec(syntax);
      expect(match?.[1]).toBe('handleClick');
    }
  });

  it('fails to match invalid syntaxes or raw JS logic', () => {
    const invalidSyntaxes = [
      "alert('XSS')",
      'console.log(event)',
      '123invalidName',
      'methodA(); methodB();',
    ];

    for (const syntax of invalidSyntaxes) {
      const match = EVENT_HANDLER_REGEX.exec(syntax);
      // It should either not match at all, or fail to extract a clean method name in group 1
      const isValidExtraction = match?.[1] === syntax.trim();
      expect(isValidExtraction).toBe(false);
    }
  });
});
