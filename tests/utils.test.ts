import { describe, it, expect } from 'vitest';
import { kebabKeys, applyParams } from '../src/utils';
import TComponent, { type ComponentParams } from '../src/TComponent';

describe('kebabKeys utility', () => {
  it('converts PascalCase object keys to kebab-case', () => {
    const DynamicList = class {};
    const UserProfile = class {};

    const result = kebabKeys({ DynamicList, UserProfile });

    expect(result).toHaveProperty('dynamic-list', DynamicList);
    expect(result).toHaveProperty('user-profile', UserProfile);
    expect(Object.keys(result)).toEqual(['dynamic-list', 'user-profile']);
  });

  it('handles camelCase correctly', () => {
    const myComponent = class {};
    const result = kebabKeys({ myComponent });
    expect(result).toHaveProperty('my-component', myComponent);
  });

  it('handles consecutive uppercase letters (Acronyms) gracefully', () => {
    const XMLParser = class {};
    const SVGIcon = class {};

    const result = kebabKeys({ XMLParser, SVGIcon });

    expect(result).toHaveProperty('xml-parser', XMLParser);
    expect(result).toHaveProperty('svg-icon', SVGIcon);
  });

  it('handles numbers in component names', () => {
    const DynamicList2Item = class {};
    const result = kebabKeys({ DynamicList2Item });
    expect(result).toHaveProperty('dynamic-list2-item', DynamicList2Item);
  });
});

describe('applyParams utility', () => {
  it('merges class, style, and applies attributes, whilst skipping id and on*', () => {
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
            onclick="handleParentClick"
          >
            <span id="slot-item">Slot Content</span>
          </childcard>
        </div>
      `;
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

    expect(card.idMap['slot-item']).toBe(slotSpan);
  });
});
