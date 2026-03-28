import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BuildContext } from '../src/BuildContext';
import { AbstractComponent } from '../src/AbstractComponent';
import { parseTemplate } from '../src/parse';
import { resetWarnings } from '../src/internal/console';
import type { ComponentParams } from '../src/types';

class DummyOwner extends AbstractComponent {
  element = document.createElement('div');
  public clickCount = 0;

  handleClick() {
    this.clickCount++;
  }
}

describe('BuildContext - DOM Building & ID Resolution', () => {
  beforeEach(() => {
    resetWarnings();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds elements and resolves id reference attributes (for, aria-*) with UUIDs', () => {
    const owner = new DummyOwner();
    const context = new BuildContext(owner, {});

    const ast = parseTemplate(`
      <div>
        <label for="input-1" id="label-1">Name</label>
        <input id="input-1" aria-labelledby="label-1" type="text" />
      </div>
    `);

    context.build(ast);
    context.resolveIdReferences();

    const label = context.idMap['label-1'] as HTMLLabelElement;
    const input = context.idMap['input-1'] as HTMLInputElement;

    expect(label.id).toMatch(/^uid-|^[0-9a-f-]{36}$/);
    expect(input.id).toMatch(/^uid-|^[0-9a-f-]{36}$/);

    expect(label.getAttribute('for')).toBe(input.id);
    expect(input.getAttribute('aria-labelledby')).toBe(label.id);
  });

  it('resolves multiple space-separated IDs and preserves unresolvable/custom component IDs', () => {
    const owner = new DummyOwner();
    const context = new BuildContext(owner, {});
    const ast = parseTemplate(`
      <div>
        <h1 id="title-1">Title</h1>
        <p id="desc-1">Description</p>
        <div aria-labelledby="  title-1    desc-1   unknown-id  ">Content</div>
      </div>
    `);

    const rootElement = context.build(ast);
    context.resolveIdReferences();

    const h1 = context.idMap['title-1'] as HTMLHeadingElement;
    const p = context.idMap['desc-1'] as HTMLParagraphElement;
    const div = rootElement.querySelector('div')!;

    expect(div.getAttribute('aria-labelledby')).toBe(
      `${h1.id} ${p.id} unknown-id`,
    );
  });
});

describe('BuildContext - Event Binding', () => {
  it('binds events to the owner component methods successfully', () => {
    const owner = new DummyOwner();
    const context = new BuildContext(owner, {});
    const ast = parseTemplate(`<button onclick="handleClick">Click</button>`);

    const button = context.build(ast) as HTMLButtonElement;
    button.click();

    expect(owner.clickCount).toBe(1);
  });

  it('warns if the event handler method is not found on the component', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const owner = new DummyOwner();
    const context = new BuildContext(owner, {});
    const ast = parseTemplate(`<button onclick="nonExistent">Error</button>`);

    context.build(ast);

    expect(warnSpy).toHaveBeenCalledWith(
      '[TComponent] Method "nonExistent" not found on component for event "onclick"',
    );
  });

  it('throws SecurityError for invalid or malicious event handler syntaxes', () => {
    const owner = new DummyOwner();
    const context = new BuildContext(owner, {});

    const maliciousAst1 = parseTemplate(
      `<button onclick="alert('XSS')">Invalid</button>`,
    );
    const maliciousAst2 = parseTemplate(
      `<button onclick="console.log(event)">Invalid</button>`,
    );
    const forbiddenAst1 = parseTemplate(
      `<button onclick="constructor">Forbidden</button>`,
    );

    expect(() => context.build(maliciousAst1)).toThrow(
      /SecurityError: Invalid event handler signature/,
    );
    expect(() => context.build(maliciousAst2)).toThrow(
      /SecurityError: Invalid event handler signature/,
    );
    expect(() => context.build(forbiddenAst1)).toThrow(
      /SecurityError: Access to "constructor" is forbidden/,
    );
  });
});

describe('BuildContext - Custom Components (uses)', () => {
  it('instantiates custom components and registers them in idMap', () => {
    class ChildComp extends AbstractComponent {
      element = document.createElement('span');
      constructor(params: ComponentParams) {
        super(params);
        this.element.className = 'child-span';
      }
    }

    const owner = new DummyOwner();
    const context = new BuildContext(owner, { childcomp: ChildComp });
    const ast = parseTemplate(
      `<div><childcomp id="my-child"></childcomp></div>`,
    );

    const rootElement = context.build(ast);

    const childInstance = context.idMap['my-child'];

    expect(childInstance).toBeInstanceOf(ChildComp);

    expect(rootElement.querySelector('.child-span')).toBeTruthy();
  });
});
