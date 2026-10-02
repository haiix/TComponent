import { describe, it, expect } from 'vitest';
import {
  isSafeTagName,
  createNativeElement,
  mergeClass,
  mergeStyle,
  applyAttributes,
  SVG_NAMESPACE_URI,
  MATHML_NAMESPACE_URI,
} from '../../src/internal/dom';

const HTML_NAMESPACE_URI = 'http://www.w3.org/1999/xhtml';

describe('isSafeTagName', () => {
  it('returns true for valid tag names', () => {
    expect(isSafeTagName('div')).toBe(true);
    expect(isSafeTagName('custom-element')).toBe(true);
    expect(isSafeTagName('h1')).toBe(true);
  });

  it('returns false for invalid or potentially dangerous tag names', () => {
    expect(isSafeTagName('<script>')).toBe(false);
    expect(isSafeTagName('div onload="alert(1)"')).toBe(false);
    expect(isSafeTagName('123div')).toBe(false); // Cannot start with a number
  });
});

describe('createNativeElement', () => {
  it('creates standard HTML elements without a namespace', () => {
    const { element, childNs } = createNativeElement('div');
    expect(element.namespaceURI).toBe(HTML_NAMESPACE_URI);
    expect(childNs).toBeUndefined();
  });

  it('assigns the correct namespace for SVG elements', () => {
    const { element, childNs } = createNativeElement('svg');
    expect(element.namespaceURI).toBe(SVG_NAMESPACE_URI);
    expect(childNs).toBe(SVG_NAMESPACE_URI); // Children should inherit the SVG namespace
  });

  it('assigns the correct namespace for MathML elements', () => {
    const { element, childNs } = createNativeElement('math');
    expect(element.namespaceURI).toBe(MATHML_NAMESPACE_URI);
    expect(childNs).toBe(MATHML_NAMESPACE_URI);
  });

  it('resets the child namespace to HTML when creating a foreignObject inside SVG', () => {
    // Parent namespace is passed down as SVG
    const { element, childNs } = createNativeElement(
      'foreignobject',
      SVG_NAMESPACE_URI,
    );

    expect(element.namespaceURI).toBe(SVG_NAMESPACE_URI);
    expect(childNs).toBe(null); // Children of foreignObject should revert to HTML
  });

  it('throws an error for invalid tag names', () => {
    expect(() => createNativeElement('<invalid>')).toThrow(
      '[TComponent] Invalid tag name: <invalid>',
    );
  });
});

describe('mergeClass', () => {
  it('appends multiple classes and ignores extra spaces', () => {
    const el = document.createElement('div');
    el.className = 'base';
    mergeClass(el, '  extra1   extra2  ');

    expect(el.className).toBe('base extra1 extra2');
  });

  it('does nothing if class value is empty or only contains spaces', () => {
    const el = document.createElement('div');
    el.className = 'base';
    mergeClass(el, '   ');

    expect(el.className).toBe('base');
  });
});

describe('mergeStyle', () => {
  it('merges styles correctly and adds a missing semicolon', () => {
    const el = document.createElement('div');
    el.setAttribute('style', 'color: blue'); // No trailing semicolon
    mergeStyle(el, 'margin: 10px;');

    expect(el.getAttribute('style')).toBe('color: blue; margin: 10px;');
  });

  it('sets style directly if element has no existing style', () => {
    const el = document.createElement('div');
    mergeStyle(el, 'color: red;');

    expect(el.getAttribute('style')).toBe('color: red;');
  });

  it('does nothing if the appended style is empty', () => {
    const el = document.createElement('div');
    el.setAttribute('style', 'color: red;');
    mergeStyle(el, '   ');

    expect(el.getAttribute('style')).toBe('color: red;');
  });
});

describe('applyAttributes', () => {
  it.each(['sprite.svg#icon', '#icon', ''])(
    'sets SVG xlink:href "%s" in the XLink namespace and keeps href separate',
    (value) => {
      const el = document.createElementNS(SVG_NAMESPACE_URI, 'use');
      applyAttributes(el, { 'xlink:href': value, href: 'other.svg#icon' });

      expect(el.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBe(
        value,
      );
      expect(el.getAttributeNode('xlink:href')?.namespaceURI).toBe(
        'http://www.w3.org/1999/xlink',
      );
      expect(el.getAttributeNS(null, 'href')).toBe('other.svg#icon');
    },
  );

  it.each([HTML_NAMESPACE_URI, MATHML_NAMESPACE_URI, 'urn:custom'])(
    'keeps xlink:href unnamespaced on elements in "%s"',
    (namespace) => {
      const el = document.createElementNS(namespace, 'use');
      applyAttributes(el, { 'xlink:href': 'sprite.svg#icon' });

      expect(el.getAttribute('xlink:href')).toBe('sprite.svg#icon');
      expect(el.getAttributeNode('xlink:href')?.namespaceURI).toBeNull();
      expect(
        el.getAttributeNS('http://www.w3.org/1999/xlink', 'href'),
      ).toBeNull();
    },
  );

  it.each(['OnClick', 'ONCLICK', 'ID', 'Id'])(
    'skips the HTML attribute "%s" without changing the DOM ID',
    (name) => {
      const el = document.createElement('div');
      el.id = 'original-id';
      applyAttributes(el, Object.freeze({ [name]: 'window.inlineRan = true' }));

      expect(el.id).toBe('original-id');
      expect(el.hasAttribute('onclick')).toBe(false);
    },
  );

  it('merges mixed-case HTML class and style attributes in input order', () => {
    const el = document.createElement('div');
    el.className = 'base';
    el.setAttribute('style', 'color: blue;');
    applyAttributes(el, {
      CLASS: 'first',
      class: 'second',
      STYLE: 'margin: 10px;',
      'DATA-Custom': 'value',
    });

    expect(el.className).toBe('base first second');
    expect(el.getAttribute('style')).toBe('color: blue; margin: 10px;');
    expect(el.getAttribute('data-custom')).toBe('value');
  });

  it.each([SVG_NAMESPACE_URI, MATHML_NAMESPACE_URI])(
    'preserves attribute case in namespace "%s"',
    (namespace) => {
      const el = document.createElementNS(namespace, 'svg');
      applyAttributes(el, { viewBox: '0 0 10 10', 'DATA-Custom': 'value' });

      expect(el.getAttribute('viewBox')).toBe('0 0 10 10');
      expect(el.hasAttribute('viewbox')).toBe(false);
      expect(el.getAttribute('DATA-Custom')).toBe('value');
      expect(el.hasAttribute('data-custom')).toBe(false);
    },
  );

  it('preserves attribute case on XHTML elements in an XML document', () => {
    const xml = document.implementation.createDocument(
      HTML_NAMESPACE_URI,
      'div',
    );
    const el = xml.documentElement;
    applyAttributes(el, { CLASS: 'value' });

    expect(el.getAttribute('CLASS')).toBe('value');
    expect(el.hasAttribute('class')).toBe(false);
  });

  it('applies general attributes and routes class/style to merge functions', () => {
    const el = document.createElement('div');
    applyAttributes(el, {
      class: 'my-class',
      style: 'color: red;',
      'data-custom': '123',
    });

    expect(el.className).toBe('my-class');
    expect(el.getAttribute('style')).toBe('color: red;');
    expect(el.getAttribute('data-custom')).toBe('123');
  });

  it('explicitly skips "id" and "on*" attributes to prevent collisions and unsafe events', () => {
    const el = document.createElement('div');
    el.id = 'original-id';

    applyAttributes(el, {
      id: 'hacked-id',
      onclick: 'alert(1)',
      onmouseover: 'hover()',
      valid: 'yes',
    });

    expect(el.id).toBe('original-id'); // ID is unchanged
    expect(el.hasAttribute('onclick')).toBe(false);
    expect(el.hasAttribute('onmouseover')).toBe(false);
    expect(el.getAttribute('valid')).toBe('yes');
  });
});
