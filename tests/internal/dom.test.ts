import { describe, it, expect } from 'vitest';
import { isSafeTagName, createNativeElement } from '../../src/internal/dom';

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
