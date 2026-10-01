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

  class Label extends TComponent<HTMLLabelElement> {
    static template = '<label></label>';

    constructor(params: ComponentParams) {
      super(params);
      applyParams(this, this.element, params);
    }
  }

  it.each(['before', 'after'] as const)(
    'resolves a forwarded for attribute when the parent input is %s the label',
    (position) => {
      const inputTemplate = '<input id="input">';
      const labelTemplate = '<label-comp for="input">Name</label-comp>';
      class Form extends TComponent {
        static uses = { 'label-comp': Label };
        static template = `<div>${
          position === 'before'
            ? inputTemplate + labelTemplate
            : labelTemplate + inputTemplate
        }</div>`;
      }

      const first = new Form();
      const second = new Form();
      for (const form of [first, second]) {
        const label = form.element.querySelector('label')!;
        const input = form.getById('input', HTMLInputElement);
        expect(input.id).toMatch(/^uid-|^[0-9a-f-]{36}$/);
        expect(label.htmlFor).toBe(input.id);
        expect(label.textContent).toBe('Name');
        expect(form.context.idReferenceMap).toHaveLength(0);
      }
      expect(first.getById('input', HTMLInputElement).id).not.toBe(
        second.getById('input', HTMLInputElement).id,
      );
      expect(Form.getParsed().template.c).toContainEqual(
        expect.objectContaining({ a: { for: 'input' } }),
      );
    },
  );

  it.each([
    'aria-labelledby',
    'aria-describedby',
    'aria-controls',
    'aria-owns',
    'aria-activedescendant',
    'aria-flowto',
    'aria-errormessage',
    'aria-details',
    'headers',
    'list',
  ])('resolves forwarded %s attributes on an internal target', (attribute) => {
    class App extends TComponent {
      static uses = { Wrapper };
      static template = `
        <div>
          <wrapper id="wrapper" ${attribute}="  title   description unknown  " class="custom" style="color: red" data-info="info">
            <span id="title">Title</span>
          </wrapper>
          <p id="description">Description</p>
        </div>
      `;
    }

    const app = new App();
    const wrapper = app.getById('wrapper', Wrapper);
    const target = wrapper.getById('body', HTMLElement);
    const title = app.getById('title', HTMLSpanElement);
    const description = app.getById('description', HTMLParagraphElement);

    expect(title.id).not.toBe('');
    expect(description.id).not.toBe('');
    expect(target.getAttribute(attribute)).toBe(
      `${title.id} ${description.id} unknown`,
    );
    expect(target.id).toBe('');
    expect(target.className).toBe('custom');
    expect(target.style.color).toBe('red');
    expect(target.getAttribute('data-info')).toBe('info');
    expect(wrapper.element.hasAttribute(attribute)).toBe(false);
  });

  it('keeps forwarded references in the parent scope even when child IDs match', () => {
    class Field extends TComponent {
      static template =
        '<section><input id="input"><span id="private">Private</span></section>';

      constructor(params: ComponentParams) {
        super(params);
        applyParams(this, this.element, params);
      }
    }
    class App extends TComponent {
      static uses = { Field };
      static template =
        '<div><field id="field" aria-labelledby="input private field unknown"></field><input id="input"></div>';
    }

    const app = new App();
    const field = app.getById('field', Field);
    const input = app.getById('input', HTMLInputElement);
    expect(input.id).not.toBe('');
    expect(field.element.getAttribute('aria-labelledby')).toBe(
      `${input.id} private field unknown`,
    );
    expect(field.getById('input', HTMLInputElement).id).toBe('');
    expect(field.getById('private', HTMLSpanElement).id).toBe('');
    expect(field.element.id).toBe('');
  });

  it('queues references in its own context when no TComponent parent is available', () => {
    class Form extends TComponent {
      static template = '<div><input id="input"></div>';
    }
    const form = new Form();
    const target = document.createElement('label');
    const attributes = Object.freeze({
      for: 'input',
      'aria-labelledby': 'missing',
    });

    applyParams(form, target, { attributes });
    expect(form.context.idReferenceMap).toHaveLength(2);
    expect(target.hasAttribute('for')).toBe(false);
    form.context.resolveIdReferences();

    const input = form.getById('input', HTMLInputElement);
    expect(input.id).not.toBe('');
    expect(target.htmlFor).toBe(input.id);
    expect(target.getAttribute('aria-labelledby')).toBe('missing');
    expect(attributes.for).toBe('input');
  });

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
