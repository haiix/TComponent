import { describe, it, expect } from 'vitest';
import { TComponent } from '../../src/TComponent';
import { appendSlots } from '../../src/internal/component';

describe('appendSlots', () => {
  it('builds child nodes using the parent component context if a parent exists', () => {
    class ParentComponent extends TComponent {
      static template = `<div></div>`;
    }
    const parent = new ParentComponent();

    class ChildComponent extends TComponent {
      static template = `<div></div>`;
    }
    const child = new ChildComponent({ parent });

    const targetEl = document.createElement('div');
    const childNodes = [
      'Text Node',
      { t: 'span', a: { class: 'slotted' }, c: [] },
    ];

    appendSlots(child, targetEl, childNodes);

    expect(targetEl.childNodes.length).toBe(2);
    expect(targetEl.childNodes[0]?.textContent).toBe('Text Node');
    expect((targetEl.childNodes[1] as Element).className).toBe('slotted');
  });

  it('falls back to the current component context if no parent is present', () => {
    class RootComponent extends TComponent {
      static template = `<div></div>`;
    }
    const root = new RootComponent(); // No parent

    const targetEl = document.createElement('div');
    appendSlots(root, targetEl, [{ t: 'p', a: {}, c: ['Fallback'] }]);

    expect(targetEl.childNodes.length).toBe(1);
    expect(targetEl.childNodes[0]?.textContent).toBe('Fallback');
  });

  it('does nothing if childNodes array is empty', () => {
    class EmptyComponent extends TComponent {
      static template = `<div></div>`;
    }
    const root = new EmptyComponent();
    const targetEl = document.createElement('div');

    appendSlots(root, targetEl, []);
    expect(targetEl.childNodes.length).toBe(0);
  });
});
