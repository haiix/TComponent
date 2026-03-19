import { describe, it, expect } from 'vitest';
import { parseTemplate } from '../src/parse';

describe('parseTemplate', () => {
  it('converts HTML string to a valid TNode tree and lowercases tags', () => {
    const html = `<DIV CLASS="container"><Span>Text</Span></DIV>`;
    const tNode = parseTemplate(html);

    expect(tNode).toEqual({
      t: 'div',
      a: { class: 'container' },
      c: [{ t: 'span', a: {}, c: ['Text'] }],
    });
  });

  it('throws an error if there is not exactly one root element', () => {
    expect(() => parseTemplate(`<div></div><span></span>`)).toThrow(
      'ParseError: The template must have exactly one root element.',
    );
    expect(() => parseTemplate(`Text node`)).toThrow(
      'ParseError: The template must have exactly one root element.',
    );
  });

  it('removes unnecessary newlines but keeps meaningful spaces by default', () => {
    const html = `
      <div>
        <span>A</span> <span>B</span>
      </div>
    `;
    const tNode = parseTemplate(html);
    expect(tNode.c[1]).toBe(' ');
  });

  it('preserves all whitespace when preserveWhitespace option is true', () => {
    const html = `
      <div>
        <span>A</span>
        <span>B</span>
      </div>
    `;
    const tNode = parseTemplate(html, { preserveWhitespace: true });

    expect(typeof tNode.c[0]).toBe('string');
    expect((tNode.c[0] as string).includes('\n')).toBe(true);
  });
});
