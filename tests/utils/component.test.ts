import { describe, it, expect } from 'vitest';
import type { ComponentParams } from '../../src/types';
import { TComponent } from '../../src/TComponent';
import { applyParams } from '../../src/utils/component';

describe('applyParams utility', () => {
  it('merges class, style, applies attributes, and correctly binds slot scope to parent', () => {
    class ChildCard extends TComponent<HTMLDivElement> {
      static template = /* HTML */ `
        <div class="base-card">
          <div
            id="card-body"
            class="body"
            style="border: 1px solid black;"
          ></div>
        </div>
      `;

      constructor(params: ComponentParams) {
        super(params);
        const target = this.idMap['card-body'] as HTMLElement;
        applyParams(this, target, params);
      }
    }

    class ParentApp extends TComponent<HTMLDivElement> {
      static uses = { ChildCard };
      static template = /* HTML */ `
        <div>
          <childcard
            id="my-card"
            class="extra-class"
            style="color: red;"
            data-custom="123"
          >
            <span id="slot-item" onclick="handleSlotClick">Slot Content</span>
          </childcard>
        </div>
      `;

      public slotClicked = false;
      handleSlotClick() {
        this.slotClicked = true;
      }
    }

    const app = new ParentApp();
    const card = app.idMap['my-card'] as ChildCard;
    const body = card.idMap['card-body'] as HTMLElement;

    expect(body.classList.contains('body')).toBe(true);
    expect(body.classList.contains('extra-class')).toBe(true);
    expect(body.getAttribute('style')).toBe(
      'border: 1px solid black; color: red;',
    );

    expect(body.getAttribute('data-custom')).toBe('123');

    expect(body.getAttribute('id')).not.toBe('my-card');
    expect(body.getAttribute('id')).toBeDefined();
    expect(body.getAttribute('onclick')).toBeNull();

    const slotSpan = body.querySelector('span')!;
    expect(slotSpan).not.toBeNull();
    expect(slotSpan.textContent).toBe('Slot Content');

    expect(app.idMap['slot-item']).toBe(slotSpan);

    slotSpan.click();
    expect(app.slotClicked).toBe(true);
  });

  it('resolves ID references correctly between Parent directly and inside Slots', () => {
    class ChildComponent extends TComponent<HTMLDivElement> {
      static template = /* HTML */ `
        <div>
          <span id="target"></span>
        </div>
      `;
      constructor(params: ComponentParams) {
        super(params);
        applyParams(this, this.idMap.target as Element, params);
      }
    }

    class ParentComponent extends TComponent<HTMLDivElement> {
      static uses = { ChildComponent };
      static template = /* HTML */ `
        <div>
          <label id="label1" for="my-input1">Label 1</label>
          <childcomponent>
            <input id="my-input1" />
          </childcomponent>

          <childcomponent>
            <label id="label2" for="my-input2">Label 2</label>
          </childcomponent>
          <input id="my-input2" />
        </div>
      `;
    }

    const parent = new ParentComponent();

    const input1 = parent.idMap['my-input1'] as HTMLInputElement;
    const input2 = parent.idMap['my-input2'] as HTMLInputElement;
    const label1 = parent.idMap.label1 as HTMLLabelElement;
    const label2 = parent.idMap.label2 as HTMLLabelElement;

    expect(input1.id).toMatch(/^tcomp-|^[0-9a-f-]{36}$/); // UUID or tcomp- fallback
    expect(input2.id).toBeTruthy();

    expect(label1.getAttribute('for')).toBe(input1.id);
    expect(label2.getAttribute('for')).toBe(input2.id);
  });
});
