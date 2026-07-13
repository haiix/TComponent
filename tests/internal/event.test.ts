import { describe, it, expect, vi } from 'vitest';
import {
  createEventHandler,
  EVENT_HANDLER_REGEX,
} from '../../src/internal/event';

describe('createEventHandler', () => {
  it('executes the dynamically resolved function with the correct this context and event', () => {
    const mockFn = vi.fn();
    const thisArg = { onerror: vi.fn(), handleClick: mockFn };

    // Pass the method name (string) instead of the function reference
    const handler = createEventHandler(thisArg, 'handleClick');

    const event = new Event('click');
    handler(event);

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn.mock.contexts[0]).toBe(thisArg);
    expect(mockFn).toHaveBeenCalledWith(event);
  });

  it('resolves the method dynamically at execution time', () => {
    const initialMock = vi.fn();
    const updatedMock = vi.fn();
    const thisArg = { onerror: vi.fn(), handleAction: initialMock };

    const handler = createEventHandler(thisArg, 'handleAction');

    // Overwrite the method after the handler has been created
    thisArg.handleAction = updatedMock;

    handler(new Event('click'));

    // The initial function should not be called, only the dynamically updated one
    expect(initialMock).not.toHaveBeenCalled();
    expect(updatedMock).toHaveBeenCalledTimes(1);
  });

  it('calls event.preventDefault() when the handler returns exactly false', () => {
    const thisArg = { onerror: vi.fn(), handleLink: () => false };
    const handler = createEventHandler(thisArg, 'handleLink');

    const event = new Event('click', { cancelable: true });
    handler(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('catches synchronous errors and forwards them to thisArg.onerror', () => {
    const thisArg = {
      onerror: vi.fn(),
      handleFail: () => {
        throw new Error('Sync Error');
      },
    };
    const handler = createEventHandler(thisArg, 'handleFail');

    handler(new Event('click'));

    expect(thisArg.onerror).toHaveBeenCalledTimes(1);
    expect(thisArg.onerror).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Sync Error' }),
    );
  });

  it('catches asynchronous promise rejections and forwards them to thisArg.onerror', async () => {
    const thisArg = {
      onerror: vi.fn(),
      handleAsyncFail: async () => {
        throw new Error('Async Error');
      },
    };
    const handler = createEventHandler(thisArg, 'handleAsyncFail');

    handler(new Event('click'));
    await Promise.resolve(); // Wait for the microtask queue

    expect(thisArg.onerror).toHaveBeenCalledTimes(1);
    expect(thisArg.onerror).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Async Error' }),
    );
  });

  it('throws a TypeError to thisArg.onerror if the method is no longer a function at execution time', () => {
    // Start with a valid function
    const thisArg = { onerror: vi.fn(), doSomething: (() => {}) as unknown };
    const handler = createEventHandler(thisArg, 'doSomething');

    // Overwrite it with a non-function value before execution
    thisArg.doSomething = 'not a function';

    handler(new Event('click'));

    expect(thisArg.onerror).toHaveBeenCalledTimes(1);
    expect(thisArg.onerror).toHaveBeenCalledWith(expect.any(TypeError));
    expect(thisArg.onerror.mock.calls[0]?.[0].message).toContain(
      'is not a function',
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
