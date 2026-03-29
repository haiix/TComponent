import { describe, it, expect } from 'vitest';
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
