import { describe, it, expect } from 'vitest';
import { parseTemplate } from '../../src/utils/parse';

describe('parseTemplate', () => {
  it('parses native template contents recursively, including text and nested templates', () => {
    expect(
      parseTemplate(
        '<template id="row">Before<span class="row">Row</span><template><b>Nested</b></template>After</template>',
      ),
    ).toEqual({
      t: 'template',
      a: { id: 'row' },
      c: [
        'Before',
        { t: 'span', a: { class: 'row' }, c: ['Row'] },
        { t: 'template', a: {}, c: [{ t: 'b', a: {}, c: ['Nested'] }] },
        'After',
      ],
    });
  });

  it.each([false, true])(
    'applies preserveWhitespace=%s inside native templates',
    (preserveWhitespace) => {
      const tNode = parseTemplate(
        '<div><template>\n  <span>A</span> <span>B</span>\n</template></div>',
        { preserveWhitespace },
      );
      const children = [
        { t: 'span', a: {}, c: ['A'] },
        ' ',
        { t: 'span', a: {}, c: ['B'] },
      ];
      expect(tNode.c).toEqual([
        {
          t: 'template',
          a: {},
          c: preserveWhitespace ? ['\n  ', ...children, '\n'] : children,
        },
      ]);
    },
  );

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
      '[TComponent] ParseError: The template must have exactly one root element.',
    );
    expect(() => parseTemplate(`Text node`)).toThrow(
      '[TComponent] ParseError: The template must have exactly one root element.',
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
