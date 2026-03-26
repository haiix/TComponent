# Caveats & Best Practices

When working close to the native DOM, understanding the underlying browser mechanics is crucial. `TComponent` aims to be transparent, meaning native HTML behaviors and limitations apply directly to your components.

This document outlines critical security practices (such as preventing XSS), how whitespace is handled during template parsing, and known limitations with native browser parsers regarding custom namespaces like SVG and MathML.

---

## Security & XSS Prevention

`TComponent` is designed to parse static HTML templates using the browser's built-in parser. **You should never concatenate untrusted user input directly into the `static template` string.**

Doing so exposes your application to Cross-Site Scripting (XSS) attacks. Instead, always keep the template static, and inject dynamic user data safely via explicit DOM manipulation in the constructor or component methods.

```typescript
// ❌ VULNERABLE: Never do this!
class BadComponent extends TComponent {
  static template = `<div>${getUserInput()}</div>`;
}

// ✅ SAFE: Explicitly mutate the DOM
class GoodComponent extends TComponent {
  static template = /* HTML */ `<div id="output"></div>`;

  constructor(params: ComponentParams) {
    super(params);
    const output = this.idMap['output'] as HTMLDivElement;
    // .textContent automatically escapes HTML entities, preventing XSS
    output.textContent = getUserInput();
  }
}
```

---

## Whitespace Handling in Templates

By default, when parsing the HTML template, `TComponent` automatically strips out pure whitespace text nodes that are used only for code indentation. Specifically, any text node that **is completely empty when trimmed AND contains a newline (`\n`)** is ignored.

- **Ignored**: `"\n  "` (e.g., line breaks with indentation spaces between HTML tags).
- **Kept**: `" "` (e.g., a single space between two `<span>` elements).

This ensures that meaningful inline spaces are preserved, while your compiled AST (`TNode`) remains as lightweight as possible.

**When to use `preserveWhitespace: true`**
If your layout relies on the browser rendering whitespace between HTML tags (for example, spaces between inline elements like `<span>` or `<button>`), or if you have a `<textarea>` that intentionally starts with empty newlines, you can override this behavior by defining `static parseOptions`.

```typescript
class PreservedWhitespaceComponent extends TComponent {
  // Instructs the parser to keep all newline-only text nodes
  static parseOptions = { preserveWhitespace: true };

  // Without preserveWhitespace: true, the newlines between these spans
  // would be removed, causing them to render right next to each other ("Item 1Item 2").
  // With it enabled, the browser will render a natural space between them.
  static template = /* HTML */ `
    <div>
      <span class="tag">Item 1</span>
      <span class="tag">Item 2</span>
      <span class="tag">Item 3</span>

      <!-- An empty textarea with intentionally preserved initial newlines -->
      <textarea id="my-input"> </textarea>
    </div>
  `;
}
```

---

## SVG & MathML CamelCase Tags Limitation

`TComponent` parses HTML strings natively using `document.createElement('template').innerHTML` to keep the library zero-dependency and tiny.

However, the browser's HTML parser **forces all tags to lowercase**. While `TComponent` correctly assigns the SVG/MathML namespaces, certain SVG tags that require camelCase (e.g., `<linearGradient>`, `<clipPath>`) will be parsed as `<lineargradient>`.

Because of this browser limitation, **complex SVGs with camelCase tags might not render correctly when written directly inside `static template`**.
For complex SVGs, it is recommended to insert them manually via DOM manipulation in the constructor, or load them externally.
