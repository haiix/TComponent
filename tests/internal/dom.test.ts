import { describe, it, expect } from 'vitest';
import {
  isSafeTagName,
  createNativeElement,
  mergeClass,
  mergeStyle,
  applyAttributes,
} from '../../src/internal/dom';

const HTML_NS = 'http://www.w3.org/1999/xhtml';
const SVG_NS = 'http://www.w3.org/2000/svg';
const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';

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
    expect(element.namespaceURI).toBe(HTML_NS);
    expect(childNs).toBeUndefined();
  });

  it('assigns the correct namespace for SVG elements', () => {
    const { element, childNs } = createNativeElement('svg');
    expect(element.namespaceURI).toBe(SVG_NS);
    expect(childNs).toBe(SVG_NS); // Children should inherit the SVG namespace
  });

  it('assigns the correct namespace for MathML elements', () => {
    const { element, childNs } = createNativeElement('math');
    expect(element.namespaceURI).toBe(MATHML_NS);
    expect(childNs).toBe(MATHML_NS);
  });

  it('resets the child namespace to HTML when creating a foreignObject inside SVG', () => {
    // Parent namespace is passed down as SVG
    const { element, childNs } = createNativeElement('foreignobject', SVG_NS);

    expect(element.namespaceURI).toBe(SVG_NS);
    expect(childNs).toBe(null); // Children of foreignObject should revert to HTML
  });

  it('throws an error for invalid tag names', () => {
    expect(() => createNativeElement('<invalid>')).toThrow(
      'Invalid tag name: <invalid>',
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
