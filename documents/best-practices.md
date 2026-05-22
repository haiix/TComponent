---
title: Caveats & Best Practices
---

# Caveats & Best Practices

When working closely with the native DOM, understanding browser mechanics is important. TComponent aims to be transparent, which means native HTML behaviors and limitations apply directly to your components.

This document outlines critical security practices (such as preventing XSS), how whitespace is handled during template parsing, and known limitations with native browser parsers regarding custom namespaces like SVG and MathML.

---

## Security & XSS Prevention

TComponent is designed to parse static HTML templates using the browser's built-in parser. **Do not concatenate untrusted user input directly into the `static template` string.**

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
    const output = this.getById('output', HTMLDivElement);
    // .textContent automatically escapes HTML entities, preventing XSS
    output.textContent = getUserInput();
  }
}
```

---

## Whitespace Handling in Templates

By default, when parsing the HTML template, TComponent automatically strips out pure whitespace text nodes that are used only for code indentation. Specifically, any text node that **is completely empty when trimmed AND contains a newline (`\n`)** is ignored.

- **Ignored**: `"\n  "` (e.g., line breaks with indentation spaces between HTML tags).
- **Kept**: `" "` (e.g., a single space between two `<span>` elements).

This ensures that meaningful inline spaces are preserved, while your compiled AST (`TNode`) remains lightweight.

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
    </div>
  `;
}
```

---

## Root Element Constraints (Composition vs. Inheritance)

When defining a component, **the root element of your `static template` must be a native HTML/SVG/MathML tag.** It cannot be a custom sub-component registered in `static uses`.

If you attempt to use a custom component as the root element, TComponent will immediately throw a `ParseError` during initialization.

### Why this limitation?

1. **Strict 1-to-1 DOM Mapping:**
   TComponent maintains a strict one-to-one mapping between a DOM element and its component instance (which makes `Component.from(element)` highly reliable). If a parent and a child component shared the exact same root DOM node, this registry would overwrite itself, creating ambiguity about which component actually owns the element.
2. **Object-Oriented Design:**
   TComponent encourages a clean mental model. If you need to modify, extend, or wrap the root behavior of an existing component, you should use **Class Inheritance** rather than component composition.

```typescript
// ❌ ERROR: Attempting to use a custom component as the root element
class InvalidComponent extends TComponent {
  static uses = kebabKeys({ CustomButton });

  // This will throw a ParseError!
  static template = /* HTML */ ` <custom-button>Click Me</custom-button> `;
}

// ✅ CORRECT: Use Class Inheritance to extend the component's behavior
class ValidComponent extends CustomButton {
  // You can override the template, lifecycle, or methods here.

  handleClick(event: MouseEvent) {
    // Optionally call the parent's logic
    super.handleClick(event);

    // Add your extended behavior
    console.log('Extended behavior executed!');
  }
}
```

If you purely want to add a layout wrapper around a custom component, you must wrap it in a native HTML element (like a `<div>` or `<section>`).

```typescript
// ✅ CORRECT: Wrapping the custom component in a native DOM element
class WrapperComponent extends TComponent {
  static uses = kebabKeys({ CustomButton });

  static template = /* HTML */ `
    <div class="button-wrapper">
      <custom-button>Click Me</custom-button>
    </div>
  `;
}
```

---

## SVG & MathML CamelCase Tags Limitation

TComponent parses HTML strings natively using `document.createElement('template').innerHTML` to keep the library zero-dependency and tiny.

However, the browser's HTML parser **forces all tags to lowercase**. While TComponent correctly assigns the SVG/MathML namespaces, certain SVG tags that require camelCase (e.g., `<linearGradient>`, `<clipPath>`) will be parsed as `<lineargradient>`.

Because of this browser limitation, **complex SVGs with camelCase tags might not render correctly when written directly inside `static template`**.
For complex SVGs, it is recommended to insert them manually via DOM manipulation in the constructor, or load them externally.
