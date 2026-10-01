import { describe, it, expect, vi } from 'vitest';
import type { ComponentParams } from '../../src/types';
import { TComponent } from '../../src/TComponent';
import { applyParams } from '../../src/utils/applyParams';

describe('applyParams', () => {
  class Wrapper extends TComponent {
    static template = '<div><section id="body"></section></div>';

    constructor(params: ComponentParams = {}) {
      super(params);
      applyParams(this, this.getById('body', HTMLElement), params);
    }
  }

  it.each(['wrapper', 'parent'] as const)(
    'unbinds nested slot events when the %s is destroyed while preserving parent scope',
    (destroyTarget) => {
      class App extends TComponent {
        static uses = { Wrapper };
        static template = `
          <div>
            <label for="slotted-button" id="label">Click</label>
            <wrapper id="wrapper">
              <section><button id="slotted-button" aria-labelledby="label" onclick="clicked">Click</button></section>
            </wrapper>
            <button id="outside" onclick="clicked">Outside</button>
          </div>
        `;
        clicked = vi.fn();
      }

      const app = new App();
      const wrapper = app.getById('wrapper', Wrapper);
      const button = app.getById('slotted-button', HTMLButtonElement);
      const label = app.getById('label', HTMLLabelElement);
      const outside = app.getById('outside', HTMLButtonElement);

      expect(wrapper.element.contains(button)).toBe(true);
      expect(label.htmlFor).toBe(button.id);
      expect(button.getAttribute('aria-labelledby')).toBe(label.id);
      button.click();
      expect(app.clicked).toHaveBeenCalledExactlyOnceWith(
        expect.any(MouseEvent),
      );

      (destroyTarget === 'wrapper' ? wrapper : app).destroy();
      button.click();
      expect(app.clicked).toHaveBeenCalledTimes(1);
      outside.click();
      expect(app.clicked).toHaveBeenCalledTimes(
        destroyTarget === 'wrapper' ? 2 : 1,
      );
      expect(app.signal.aborted).toBe(destroyTarget === 'parent');
    },
  );

  it.each(['wrapper', 'parent'] as const)(
    'cleans up custom components and forwarded slots when the %s is destroyed',
    (destroyTarget) => {
      class Slotted extends TComponent {
        static template = '<button onclick="clicked">Slotted</button>';
        clicked = vi.fn();
        cleanup = vi.fn();

        constructor(params: ComponentParams) {
          super(params);
          this.signal.addEventListener('abort', this.cleanup, { once: true });
        }
      }

      class App extends TComponent {
        static uses = { Wrapper, Slotted };
        static template = `
          <div>
            <wrapper id="wrapper">
              <section>
                <slotted id="slotted"></slotted>
                <wrapper id="inner"><button id="forwarded" onclick="clicked">Forwarded</button></wrapper>
              </section>
            </wrapper>
            <slotted id="sibling"></slotted>
          </div>
        `;
        clicked = vi.fn();
        onerror = vi.fn();
      }

      const app = new App();
      const wrapper = app.getById('wrapper', Wrapper);
      const inner = app.getById('inner', Wrapper);
      const slotted = app.getById('slotted', Slotted);
      const sibling = app.getById('sibling', Slotted);
      const button = slotted.element as HTMLButtonElement;
      const forwarded = app.getById('forwarded', HTMLButtonElement);

      expect(slotted.parent).toBe(app);
      expect(inner.parent).toBe(app);
      const error = new Error('slot error');
      slotted.onerror(error);
      expect(app.onerror).toHaveBeenCalledWith(error);
      button.click();
      forwarded.click();
      expect(slotted.clicked).toHaveBeenCalledTimes(1);
      expect(app.clicked).toHaveBeenCalledTimes(1);

      (destroyTarget === 'wrapper' ? wrapper : app).destroy();
      button.click();
      forwarded.click();
      expect(slotted.clicked).toHaveBeenCalledTimes(1);
      expect(app.clicked).toHaveBeenCalledTimes(1);
      expect(inner.signal.aborted).toBe(true);
      expect(slotted.signal.aborted).toBe(true);
      expect(slotted.cleanup).toHaveBeenCalledTimes(1);
      sibling.element.dispatchEvent(new MouseEvent('click'));
      expect(sibling.clicked).toHaveBeenCalledTimes(
        destroyTarget === 'wrapper' ? 1 : 0,
      );
      expect(sibling.cleanup).toHaveBeenCalledTimes(
        destroyTarget === 'wrapper' ? 0 : 1,
      );
      wrapper.destroy();
      expect(slotted.cleanup).toHaveBeenCalledTimes(1);
    },
  );

  it('orchestrates applyAttributes and appendSlots when params are provided', () => {
    class TestComponent extends TComponent {
      static template = `<div></div>`;
    }
    const comp = new TestComponent();
    const targetEl = document.createElement('div');

    const params: ComponentParams = {
      attributes: { class: 'test-class', 'data-info': 'info' },
      childNodes: ['Hello Slots'],
    };

    applyParams(comp, targetEl, params);

    expect(targetEl.className).toBe('test-class');
    expect(targetEl.getAttribute('data-info')).toBe('info');
    expect(targetEl.childNodes[0]?.textContent).toBe('Hello Slots');
  });

  it('binds events to the parent context successfully', () => {
    class ParentComponent extends TComponent {
      static template = `<div></div>`;
      handleEvent = vi.fn();
    }
    const parent = new ParentComponent();

    class ChildComponent extends TComponent {
      static template = `<div></div>`;
    }
    const child = new ChildComponent({ parent });

    const targetEl = document.createElement('div');

    const params: ComponentParams = { attributes: { onclick: 'handleEvent' } };

    // Apply params onto targetEl
    applyParams(child, targetEl, params);

    // Simulate click
    targetEl.click();

    // Event should be resolved in the parent's context
    expect(parent.handleEvent).toHaveBeenCalledTimes(1);
  });

  it('unbinds events properly when the child component is destroyed (lifecycle binding)', () => {
    class ParentComponent extends TComponent {
      static template = `<div></div>`;
      handleEvent = vi.fn();
    }
    const parent = new ParentComponent();

    class ChildComponent extends TComponent {
      static template = `<div></div>`;
    }
    const child = new ChildComponent({ parent });

    const targetEl = document.createElement('div');
    applyParams(child, targetEl, { attributes: { onclick: 'handleEvent' } });

    // Destroying the child should abort the signal and unbind the event
    child.destroy();
    targetEl.click();

    expect(parent.handleEvent).not.toHaveBeenCalled();
  });

  it('does not throw when attributes and childNodes are omitted', () => {
    class TestComponent extends TComponent {
      static template = `<div></div>`;
    }
    const comp = new TestComponent();
    const targetEl = document.createElement('div');

    // Should run smoothly without throwing an error
    applyParams(comp, targetEl, {});

    expect(targetEl.attributes.length).toBe(0);
    expect(targetEl.childNodes.length).toBe(0);
  });
});
