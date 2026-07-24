import { describe, it, expect, vi } from 'vitest';
import type { ComponentParams } from '../../src/types';
import { TComponent } from '../../src/TComponent';
import { applyParams } from '../../src/utils/applyParams';

describe('applyParams', () => {
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
