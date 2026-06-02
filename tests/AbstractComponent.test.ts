import { describe, it, expect, vi } from 'vitest';
import { AbstractComponent } from '../src/AbstractComponent';

class TestComponent extends AbstractComponent {
  element = document.createElement('div');
}

describe('AbstractComponent', () => {
  describe('constructor', () => {
    it('sets the parent component', () => {
      const parent = new TestComponent();
      const child = new TestComponent({ parent });

      expect(child.parent).toBe(parent);
    });

    it('throws when both parent and signal are provided', () => {
      const parent = new TestComponent();
      const controller = new AbortController();

      expect(() => {
        new TestComponent({ parent, signal: controller.signal });
      }).toThrow(
        'Cannot provide a signal when a parent component is already set.',
      );
    });
  });

  describe('signal', () => {
    it('creates the signal lazily', () => {
      const component = new TestComponent();
      expect(component.signal).toBe(component.signal);
    });

    it('links to the provided signal', () => {
      const parentController = new AbortController();
      const component = new TestComponent({ signal: parentController.signal });

      expect(component.signal.aborted).toBe(false);
      parentController.abort();
      expect(component.signal.aborted).toBe(true);
    });

    it('links to the parent component signal', () => {
      const parent = new TestComponent();
      const child = new TestComponent({ parent });

      expect(child.signal.aborted).toBe(false);
      parent.destroy();
      expect(child.signal.aborted).toBe(true);
    });
  });

  describe('destroy', () => {
    it('aborts the component signal', () => {
      const component = new TestComponent();
      const signal = component.signal;

      expect(signal.aborted).toBe(false);
      component.destroy();
      expect(signal.aborted).toBe(true);
    });

    it('removes the element from the DOM', () => {
      const component = new TestComponent();
      document.body.append(component.element);

      expect(document.body.contains(component.element)).toBe(true);
      component.destroy();
      expect(document.body.contains(component.element)).toBe(false);
    });

    it('does not fail if no signal was created', () => {
      const component = new TestComponent();
      expect(() => {
        component.destroy();
      }).not.toThrow();
    });
  });

  describe('onerror', () => {
    it('delegates errors to the parent component', () => {
      const parent = new TestComponent();
      const child = new TestComponent({ parent });
      const error = new Error('test error');

      const onerrorSpy = vi
        .spyOn(parent, 'onerror')
        .mockImplementation(() => {});

      child.onerror(error);

      expect(onerrorSpy).toHaveBeenCalledTimes(1);
      expect(onerrorSpy).toHaveBeenCalledWith(error);
    });

    it('throws the error when no parent exists', () => {
      const component = new TestComponent();
      const error = new Error('test error');

      expect(() => {
        component.onerror(error);
      }).toThrow(error);
    });

    it('bubbles errors through multiple parents', () => {
      const root = new TestComponent();
      const parent = new TestComponent({ parent: root });
      const child = new TestComponent({ parent });
      const error = new Error('test error');

      const rootSpy = vi.spyOn(root, 'onerror').mockImplementation(() => {});

      child.onerror(error);

      expect(rootSpy).toHaveBeenCalledTimes(1);
      expect(rootSpy).toHaveBeenCalledWith(error);
    });
  });
});
