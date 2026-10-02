import { describe, it, expect } from 'vitest';
import { TComponent } from '../../src/TComponent';
import { appendSlots } from '../../src/internal/slots';
import {
  SVG_NAMESPACE_URI,
  MATHML_NAMESPACE_URI,
} from '../../src/internal/dom';
import type { TNode } from '../../src/types';

const HTML_NAMESPACE_URI = 'http://www.w3.org/1999/xhtml';

describe.each(['slots', 'template'] as const)('%s namespaces', (mode) => {
  function buildChildren(
    tag: string,
    ns: string,
    attributes: Record<string, string>,
    children: TNode[],
  ) {
    const component = new TComponent();
    if (mode === 'template') {
      return component.context.build(
        { t: tag, a: attributes, c: children },
        ns,
      );
    }
    const target = document.createElementNS(ns, tag);
    for (const [name, value] of Object.entries(attributes)) {
      target.setAttribute(name, value);
    }
    appendSlots(component, target, children);
    return target;
  }

  it.each([
    ['g', SVG_NAMESPACE_URI, 'circle'],
    ['mrow', MATHML_NAMESPACE_URI, 'mrow'],
    ['div', HTML_NAMESPACE_URI, 'span'],
    ['container', 'urn:custom', 'child'],
  ])('inherits the namespace of %s', (tag, ns, child) => {
    const target = buildChildren(tag, ns, {}, [
      { t: child, a: {}, c: [{ t: child, a: {}, c: [] }] },
    ]);
    expect(target.firstElementChild?.namespaceURI).toBe(ns);
    expect(target.firstElementChild?.firstElementChild?.namespaceURI).toBe(ns);
  });

  it('preserves camelCase SVG names when appending children', () => {
    const target = buildChildren('svg', SVG_NAMESPACE_URI, {}, [
      { t: 'linearGradient', a: {}, c: [] },
      { t: 'clipPath', a: {}, c: [] },
    ]);
    expect(target.children[0]?.localName).toBe('linearGradient');
    expect(target.children[1]?.localName).toBe('clipPath');
    for (const child of target.children) {
      expect(child).toBeInstanceOf(SVGElement);
      expect(child.namespaceURI).toBe(SVG_NAMESPACE_URI);
    }
  });

  it.each(['foreignObject', 'foreignobject', 'desc', 'title'])(
    'switches SVG %s children to HTML and can re-enter SVG or MathML',
    (tag) => {
      const target = buildChildren(tag, SVG_NAMESPACE_URI, {}, [
        {
          t: 'div',
          a: {},
          c: [
            { t: 'svg', a: {}, c: [{ t: 'circle', a: {}, c: [] }] },
            { t: 'math', a: {}, c: [{ t: 'mrow', a: {}, c: [] }] },
          ],
        },
      ]);
      expect(target.firstElementChild?.namespaceURI).toBe(HTML_NAMESPACE_URI);
      expect(target.querySelector('svg')?.namespaceURI).toBe(SVG_NAMESPACE_URI);
      expect(target.querySelector('circle')?.namespaceURI).toBe(
        SVG_NAMESPACE_URI,
      );
      expect(target.querySelector('math')?.namespaceURI).toBe(
        MATHML_NAMESPACE_URI,
      );
      expect(target.querySelector('mrow')?.namespaceURI).toBe(
        MATHML_NAMESPACE_URI,
      );
    },
  );

  it.each([
    ['text/html', HTML_NAMESPACE_URI],
    ['TEXT/HTML', HTML_NAMESPACE_URI],
    ['application/xhtml+xml', HTML_NAMESPACE_URI],
    ['Application/XHTML+XML', HTML_NAMESPACE_URI],
    ['application/xml', MATHML_NAMESPACE_URI],
    ['', MATHML_NAMESPACE_URI],
    [' text/html ', MATHML_NAMESPACE_URI],
  ])('resolves annotation-xml encoding %s', (encoding, expectedNs) => {
    const target = buildChildren(
      'annotation-xml',
      MATHML_NAMESPACE_URI,
      encoding ? { encoding } : {},
      [
        { t: 'span', a: {}, c: [] },
        { t: 'svg', a: {}, c: [{ t: 'circle', a: {}, c: [] }] },
      ],
    );
    expect(target.firstElementChild?.namespaceURI).toBe(expectedNs);
    expect(target.querySelector('circle')?.namespaceURI).toBe(
      SVG_NAMESPACE_URI,
    );
  });

  it.each(['mi', 'mo', 'mn', 'ms', 'mtext'])(
    'switches MathML %s children to HTML except mglyph and malignmark',
    (tag) => {
      const target = buildChildren(tag, MATHML_NAMESPACE_URI, {}, [
        { t: 'span', a: {}, c: [] },
        { t: 'mglyph', a: {}, c: [] },
        { t: 'malignmark', a: {}, c: [] },
      ]);
      expect(target.children[0]?.namespaceURI).toBe(HTML_NAMESPACE_URI);
      expect(target.children[1]?.namespaceURI).toBe(MATHML_NAMESPACE_URI);
      expect(target.children[2]?.namespaceURI).toBe(MATHML_NAMESPACE_URI);
    },
  );

  it.each(['foreignobject', 'annotation-xml', 'mtext', 'title'])(
    'does not apply integration rules to %s in another namespace',
    (tag) => {
      const target = buildChildren(
        tag,
        'urn:custom',
        { encoding: 'text/html' },
        [{ t: 'span', a: {}, c: [] }],
      );
      expect(target.firstElementChild?.namespaceURI).toBe('urn:custom');
    },
  );
});

describe('appendSlots', () => {
  it('builds child nodes using the explicitly provided context component', () => {
    class ParentComponent extends TComponent {
      static template = `<div></div>`;
    }
    const parent = new ParentComponent();

    class ChildComponent extends TComponent {
      static template = `<div></div>`;
    }
    new ChildComponent({ parent });

    const targetEl = document.createElement('div');
    const childNodes = [
      'Text Node',
      { t: 'span', a: { class: 'slotted' }, c: [] },
    ];

    // Explicitly pass the parent context
    appendSlots(parent, targetEl, childNodes);

    expect(targetEl.childNodes.length).toBe(2);
    expect(targetEl.childNodes[0]?.textContent).toBe('Text Node');
    expect((targetEl.childNodes[1] as Element).className).toBe('slotted');
  });

  it('falls back seamlessly if the child component itself is passed as context', () => {
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

  it('instantiates custom components successfully when they are at the top level of the slots', () => {
    class SlottedCustomComp extends TComponent {
      static template = `<span class="slotted-custom">Slotted</span>`;
    }

    class ParentComponent extends TComponent {
      static uses = { SlottedCustomComp };
      static template = `<div></div>`;
    }
    const parent = new ParentComponent();

    class ChildComponent extends TComponent {
      static template = `<div></div>`;
    }
    new ChildComponent({ parent });

    const targetEl = document.createElement('div');

    const childNodes = [
      { t: 'slottedcustomcomp', a: { id: 'my-slotted' }, c: [] },
    ];

    // Pass the parent context so it can resolve `SlottedCustomComp`
    appendSlots(parent, targetEl, childNodes);

    expect(targetEl.childNodes.length).toBe(1);
    const mountedEl = targetEl.childNodes[0] as HTMLElement;
    expect(mountedEl.tagName.toLowerCase()).toBe('span');
    expect(mountedEl.className).toBe('slotted-custom');

    // The sub-component is registered in the parent's idMap
    const inst = parent.getById('my-slotted');
    expect(inst).toBeInstanceOf(SlottedCustomComp);
  });
});
