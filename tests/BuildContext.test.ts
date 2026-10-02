import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BuildContext } from '../src/BuildContext';
import { AbstractComponent } from '../src/AbstractComponent';
import { parseTemplate } from '../src/utils/parse';
import { resetWarnings } from '../src/internal/messages';
import type { ComponentParams } from '../src/types';
import { TComponent } from '../src/TComponent';

class DummyOwner extends AbstractComponent {
  element = document.createElement('div');

  handleClick() {}
}

describe('BuildContext - DOM Building & ID Resolution', () => {
  it('resolves page links and SVG use references with distinct IDs per instance', () => {
    class Links extends TComponent {
      static template = `
        <div>
          <a href="#section">Go</a>
          <label for="section">Section</label>
          <section id="section">Target</section>
          <svg>
            <defs><path id="shape" d="M0 0 L10 10"></path></defs>
            <use href="#shape"></use>
            <use xlink:href="#shape"></use>
          </svg>
        </div>
      `;
    }
    const first = new Links();
    const second = new Links();
    for (const links of [first, second]) {
      document.body.append(links.element);
      try {
        const section = links.getById('section', HTMLElement);
        const shape = links.getById('shape', SVGElement);
        expect(section.id).not.toBe('');
        expect(shape.id).not.toBe('');
        expect(links.element.querySelector('a')!.getAttribute('href')).toBe(
          `#${section.id}`,
        );
        expect(links.element.querySelector('label')!.htmlFor).toBe(section.id);
        expect(links.element.querySelector('use')!.getAttribute('href')).toBe(
          `#${shape.id}`,
        );
        expect(
          links.element
            .querySelectorAll('use')[1]!
            .getAttributeNS('http://www.w3.org/1999/xlink', 'href'),
        ).toBe(`#${shape.id}`);
        expect(document.getElementById(section.id)).toBe(section);
        expect(document.getElementById(shape.id)).toBe(shape);
        expect(links.context.idReferenceMap).toHaveLength(0);
      } finally {
        links.element.remove();
      }
    }
    expect(first.getById('section', HTMLElement).id).not.toBe(
      second.getById('section', HTMLElement).id,
    );
    expect(first.getById('shape', SVGElement).id).not.toBe(
      second.getById('shape', SVGElement).id,
    );
  });

  it.each(['href', 'xlink:href'])(
    'preserves nonlocal and unresolved %s values',
    (name) => {
      const context = new BuildContext(new DummyOwner(), {});
      const values = [
        'https://example.com/page#target',
        '/page#target',
        'other.svg#target',
        '#missing',
        '#',
        '',
        '  #missing  ',
      ];
      const root = context.build({
        t: 'svg',
        a: {},
        c: [
          ...values.map((value) => ({ t: 'use', a: { [name]: value }, c: [] })),
          { t: 'path', a: { id: 'target' }, c: [] },
        ],
      });
      context.resolveIdReferences();
      expect(
        Array.from(root.querySelectorAll('use'), (el) => el.getAttribute(name)),
      ).toEqual(values);
      expect(root.querySelector('path')!.id).toBe('');
    },
  );

  it.each([
    'fill',
    'stroke',
    'filter',
    'clip-path',
    'mask',
    'marker',
    'marker-start',
    'marker-mid',
    'marker-end',
  ])(
    'resolves local SVG %s URLs while preserving syntax and other values',
    (name) => {
      const context = new BuildContext(new DummyOwner(), {});
      const value = `url(#paint) url( '#paint' ) URL( "#paint" ) red url(#missing) url(other.svg#paint)`;
      const root = context.build({
        t: 'svg',
        a: {},
        c: [
          { t: 'path', a: { [name]: value }, c: [] },
          {
            t: 'defs',
            a: {},
            c: [{ t: 'linearGradient', a: { id: 'paint' }, c: [] }],
          },
        ],
      });
      context.resolveIdReferences();
      const paint = context.idMap.paint as Element;
      expect(paint.id).not.toBe('');
      expect(root.querySelector('path')!.getAttribute(name)).toBe(
        `url(#${paint.id}) url( '#${paint.id}' ) URL( "#${paint.id}" ) red url(#missing) url(other.svg#paint)`,
      );
    },
  );

  it('keeps unsupported URL values and CSS intact without generating target IDs', () => {
    const context = new BuildContext(new DummyOwner(), {});
    const root = context.build(
      parseTemplate(`
      <div fill="url(#paint)">
        <svg>
          <defs><path id="paint"></path></defs>
          <path fill="url('#paint&quot;)" stroke="url()" filter="url(#missing)" style="fill: url(#paint)"></path>
          <style>path { fill: url(#paint); }</style>
        </svg>
      </div>
    `),
    );
    context.resolveIdReferences();
    const path = root.querySelectorAll('path')[1]!;
    expect(root.getAttribute('fill')).toBe('url(#paint)');
    expect(path.getAttribute('fill')).toBe(`url('#paint")`);
    expect(path.getAttribute('stroke')).toBe('url()');
    expect(path.getAttribute('filter')).toBe('url(#missing)');
    expect(path.getAttribute('style')).toBe('fill: url(#paint)');
    expect(root.querySelector('style')!.textContent).toBe(
      'path { fill: url(#paint); }',
    );
    expect((context.idMap.paint as Element).id).toBe('');
  });

  it('preserves fragment references to custom components and uses the first duplicate native ID', () => {
    const context = new BuildContext(new DummyOwner(), {});
    context.idMap.child = new DummyOwner();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const root = context.build(
      parseTemplate(`
      <div><a href="#child">Child</a><a href="  #target  ">Target</a>
      <section id="target"></section><section id="target"></section></div>
    `),
    );
    context.resolveIdReferences();
    const sections = root.querySelectorAll('section');
    expect(root.querySelector('a')!.getAttribute('href')).toBe('#child');
    expect(sections[0]!.id).not.toBe('');
    expect(sections[1]!.id).toBe('');
    expect(root.querySelectorAll('a')[1]!.getAttribute('href')).toBe(
      `  #${sections[0]!.id}  `,
    );
  });

  it('appends native template children to content when building or adding children', () => {
    const context = new BuildContext(new DummyOwner(), {});
    const template = context.build({
      t: 'template',
      a: { class: 'row-template' },
      c: ['Before', { t: 'span', a: {}, c: ['Row'] }],
    }) as HTMLTemplateElement;
    context.appendChildren(template, ['After']);

    expect(template).toBeInstanceOf(HTMLTemplateElement);
    expect(template.className).toBe('row-template');
    expect(template.childNodes).toHaveLength(0);
    expect(template.content.childNodes).toHaveLength(3);
    expect(template.content.textContent).toBe('BeforeRowAfter');
    expect(template.content.querySelector('span')?.namespaceURI).toBe(
      'http://www.w3.org/1999/xhtml',
    );
  });

  it('keeps ordinary children for a template tag in a non-HTML namespace', () => {
    const context = new BuildContext(new DummyOwner(), {});
    const template = context.build(
      { t: 'template', a: {}, c: [{ t: 'child', a: {}, c: ['Row'] }] },
      'urn:custom',
    );

    expect(template).not.toBeInstanceOf(HTMLTemplateElement);
    expect(template.firstElementChild?.namespaceURI).toBe('urn:custom');
    expect(template.textContent).toBe('Row');
  });

  beforeEach(() => {
    resetWarnings();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['toString', 'constructor', '__proto__'])(
    'resolves references to registered ID "%s" and preserves unregistered references',
    (id) => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const context = new BuildContext(new DummyOwner(), {});
      const ast = parseTemplate(`
        <div>
          <label for="${id}" aria-labelledby="${id} unknown-id">Name</label>
          <input id="${id}" />
        </div>
      `);
      const root = context.build(ast);
      context.resolveIdReferences();

      const label = root.querySelector('label')!;
      const input = root.querySelector('input')!;
      expect(input.id).not.toBe('');
      expect(label.htmlFor).toBe(input.id);
      expect(label.getAttribute('aria-labelledby')).toBe(
        `${input.id} unknown-id`,
      );
      expect(context.idMap[id]).toBe(input);
      expect(warnSpy).not.toHaveBeenCalled();

      const emptyContext = new BuildContext(new DummyOwner(), {});
      const unresolved = emptyContext.build(
        parseTemplate(`<label for="${id}">Name</label>`),
      );
      emptyContext.resolveIdReferences();
      expect(unresolved.getAttribute('for')).toBe(id);
    },
  );

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

    const clickSpy = vi.spyOn(owner, 'handleClick');

    const button = context.build(ast) as HTMLButtonElement;
    button.click();

    expect(clickSpy).toHaveBeenCalledTimes(1);
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
  it.each(['constructor', 'toString', 'hasOwnProperty'])(
    'builds unregistered %s children as native DOM elements',
    (tag) => {
      const context = new BuildContext(new DummyOwner(), {});
      const root = context.build({
        t: 'div',
        a: {},
        c: [{ t: tag, a: { id: 'child', class: 'native' }, c: ['Content'] }],
      });

      const child = context.idMap.child;
      expect(child).toBeInstanceOf(HTMLElement);
      expect(root.firstElementChild).toBe(child);
      expect(root.firstElementChild!.localName).toBe(tag);
      expect(root.firstElementChild!.className).toBe('native');
      expect(root.firstElementChild!.textContent).toBe('Content');
    },
  );

  it('ignores custom components inherited from the uses dictionary prototype', () => {
    const uses = {};
    Object.setPrototypeOf(uses, { inherited: DummyOwner });
    const context = new BuildContext(new DummyOwner(), uses);
    const root = context.build(
      parseTemplate('<div><inherited id="child">Content</inherited></div>'),
    );

    expect(context.idMap.child).toBeInstanceOf(HTMLElement);
    expect(root.firstElementChild!.localName).toBe('inherited');
    expect(root.firstElementChild!.textContent).toBe('Content');
  });

  it.each(['constructor', 'toString', 'hasOwnProperty'])(
    'instantiates an explicitly registered %s child component',
    (tag) => {
      const owner = new DummyOwner();
      const context = new BuildContext(owner, { [tag]: DummyOwner });
      const root = context.build({
        t: 'div',
        a: {},
        c: [{ t: tag, a: { id: 'child' }, c: [] }],
      });

      const child = context.idMap.child as DummyOwner;
      expect(child).toBeInstanceOf(DummyOwner);
      expect(child.parent).toBe(owner);
      expect(root.firstElementChild).toBe(child.element);
    },
  );

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
