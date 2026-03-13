# TComponent: Advanced Usage & Documentation

While `TComponent` is designed to be incredibly simple and non-reactive, its architecture—based on parsing HTML into an Abstract Syntax Tree (AST) called `TNode`—allows for highly advanced, flexible, and explicit UI patterns.

This document covers detailed usage, composition strategies, and edge cases.

---

## 1. Component Composition

You can compose complex UIs by registering child components using the `static uses` property. The key is matched against the tag name used in the template (case-insensitive).

### Important Note on Props and Slots

In `TComponent`, attributes (props) and child nodes (slots) passed to a sub-component are **not** automatically applied to its root element.

This is a deliberate design choice: a component might need to apply certain attributes to a specific internal element rather than the root, ensuring you have complete, explicit control over the DOM. You must manually handle them inside the child component's constructor via `params.attributes` and `params.childNodes`.

### Basic Example: Handling Props and Slots

```typescript
import TComponent, { ComponentParams } from '@haiix/tcomponent';

class ChildComponent extends TComponent<HTMLDivElement> {
  static template = /* HTML */ `<div class="child"></div>`;

  constructor(params: ComponentParams) {
    super(params);

    // 1. Manually apply passed attributes (Props)
    if (params.attributes?.['data-text']) {
      this.element.textContent = params.attributes['data-text'];
    }

    // 2. Manually append child nodes (Slots)
    if (params.childNodes) {
      for (const child of params.childNodes) {
        if (typeof child === 'string') {
          this.element.appendChild(document.createTextNode(child));
        }
        // Note: If 'child' is a TNode, you could build it here using the `build` function.
      }
    }
  }
}

class ParentComponent extends TComponent<HTMLDivElement> {
  static uses = { ChildComponent };

  static template = /* HTML */ `
    <div>
      <childcomponent data-text="Hello from Parent!">
        This is slot text.
      </childcomponent>
    </div>
  `;
}
```

---

## 2. AbstractComponent vs. TComponent

`TComponent` is actually a feature-rich subclass of a much simpler base class called `AbstractComponent`.

- **`TComponent`**: Provides the high-level API you use most of the time. It automatically parses the `static template` into an AST, builds the DOM, resolves ID references (`idMap`), and binds events.
- **`AbstractComponent`**: The minimal, bare-bones foundation. It only provides the component tree structure (the `parent` reference) and the error bubbling mechanism (`onerror`). It does **not** handle HTML templates or event binding automatically. It requires you to explicitly define and construct the `element` property yourself.

### When should you use `AbstractComponent` directly?

You should extend `AbstractComponent` instead of `TComponent` when:

1. You don't need a static HTML template (e.g., generating DOM entirely via `document.createElement`).
2. You want absolute maximum performance by skipping the template parsing phase entirely.
3. You are building highly specialized structural components—such as loops, conditionals, or dynamic slots—that manipulate the raw AST (`TNode`) directly.

**Example of a purely manual component:**

```typescript
import { AbstractComponent, ComponentParams } from '@user/tcomponent';

export class ManualComponent extends AbstractComponent {
  element: HTMLDivElement;

  constructor(params: ComponentParams) {
    super(params); // Sets up 'this.parent' and error bubbling

    // Completely manual DOM construction
    this.element = document.createElement('div');
    this.element.className = 'manual-box';
    this.element.textContent = 'I have no static template!';
  }
}
```

---

## 3. Advanced AST Manipulation (Dynamic Templates)

Because `TComponent` compiles templates into a lightweight AST (`TNode`), you don't have to render child nodes immediately. You can capture a child node's AST and use it as a **reusable template** to generate new DOM nodes dynamically.

### Example: A Generic Dynamic List

In this advanced example, a `DynamicList` component captures its first child as a template (e.g., an `<li>`), and re-evaluates that AST whenever a new item is added.

```typescript
import TComponent, {
  AbstractComponent,
  ComponentParams,
  TNode,
  build,
  kebabKeys,
} from '@haiix/tcomponent';

/**
 * A generic dynamic list component that uses its child AST as a template.
 */
class DynamicList extends AbstractComponent {
  parent: AbstractComponent;
  element: Element;
  private templateNode: TNode;
  private parentUses: Record<string, typeof AbstractComponent>;
  private signal: AbortSignal;

  constructor(params: ComponentParams & { signal: AbortSignal }) {
    super(params);

    if (!params.parent || !params.childNodes?.length) {
      throw new Error(
        'DynamicList requires a parent component and exactly one child template.',
      );
    }
    this.parent = params.parent;

    // 1. Dynamically create the root element's AST (defaulting to <ul>) and build it.
    const tagName = params.attributes?.tagname || 'ul';
    const rootAst: TNode = { t: tagName, a: { ...params.attributes }, c: [] };
    delete rootAst.a.tagname; // Clean up custom props

    // Safely retrieve custom components registered in the parent
    this.parentUses =
      (params.parent.constructor as typeof TComponent).parsedUses ?? {};

    const { element } = build(
      rootAst,
      params.parent,
      this.parentUses,
      params.signal,
    );
    this.element = element;

    // 2. Save the child element (Slot) as a reusable list-item template
    const childTNode = params.childNodes[0];
    if (!childTNode || typeof childTNode === 'string') {
      throw new Error(
        'DynamicList template must be an HTML element, not plain text.',
      );
    }
    this.templateNode = childTNode;

    this.signal = params.signal;
  }

  /**
   * Appends a new item by re-evaluating the saved AST template.
   */
  append(childContent: string | Node) {
    // Generate new DOM elements from the saved AST template
    const { element: li } = build(
      this.templateNode,
      this.parent,
      this.parentUses,
      this.signal,
    );

    // Insert content and append to the list
    li.append(childContent);
    this.element.append(li);
  }
}

// --- Usage ---

class App extends TComponent {
  // The kebabKeys utility automatically converts PascalCase component names into kebab-case tag names.
  static uses = kebabKeys({ DynamicList });

  static template = /* HTML */ `
    <div>
      <h2>My Dynamic List</h2>
      <!-- DynamicList takes the 'li' as a reusable AST template -->
      <dynamic-list tagname="ol" id="my-list" class="list-container">
        <li class="list-item"></li>
      </dynamic-list>

      <button onclick="handleAddButton">Add Item</button>
    </div>
  `;

  // Get the component instance safely via idMap
  list = this.idMap['my-list'] as DynamicList;
  itemCount = 0;

  handleAddButton() {
    this.itemCount++;
    // A new <li> element is generated from the AST template and appended
    this.list.append(`Item #${this.itemCount}`);
  }
}
```

---

## 4. Accessibility and ID References

`TComponent` automatically generates UUIDs for elements with an `id` attribute. It also intelligently updates attributes that reference IDs (such as `for`, `aria-labelledby`, `aria-controls`, etc.) so that your accessibility tree remains intact without worrying about global ID collisions across multiple component instances.

```typescript
class AccessibleForm extends TComponent<HTMLFormElement> {
  static template = /* HTML */ `
    <form>
      <!-- "my-input" becomes a UUID (e.g., '123e4567-...'). -->
      <!-- The label's "for" attribute automatically updates to match it. -->
      <label for="my-input">Username:</label>
      <input id="my-input" aria-describedby="desc" type="text" />
      <span id="desc">Please enter your full name.</span>
    </form>
  `;
}
```

_Note: If an ID reference contains multiple space-separated IDs, `TComponent` resolves all of them correctly._

---

## 5. Error Boundaries and Bubbling

If an event listener throws an error (or a Promise rejects), `TComponent` catches it and calls the `onerror` method. If the current component does not override `onerror` or explicitly throws the error again, the error bubbles up to the parent component.

This allows you to create top-level "Error Boundary" components to handle UI failures gracefully.

```typescript
class Child extends TComponent {
  static template = /* HTML */ `<button onclick="doAction">
    Throw Error
  </button>`;

  async doAction() {
    // Both synchronous errors and unhandled Promise rejections are caught
    throw new Error('Something went wrong in the child!');
  }
}

class Parent extends TComponent {
  static uses = { Child };
  static template = /* HTML */ `<div><child></child></div>`;

  onerror(error: unknown) {
    // This will catch the error thrown by the Child component
    console.error('Caught in Parent Error Boundary:', error);
  }
}
```

---

## 6. Caveats & Best Practices

### Security & XSS Prevention

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

### Whitespace Handling in Templates

When parsing the HTML template, `TComponent` automatically strips out pure whitespace text nodes that are used only for code indentation.

Specifically, any text node that **is completely empty when trimmed AND contains a newline (`\n`)** is ignored.

- **Ignored**: `"\n  "` (e.g., line breaks with indentation spaces between HTML tags).
- **Kept**: `" "` (e.g., a single space between two `<span>` elements).

This ensures that meaningful inline spaces are preserved, while your compiled AST (`TNode`) remains as lightweight as possible without unnecessary DOM nodes.

### The Importance of `AbortSignal`

When instantiating a component, it is highly recommended to pass an `AbortSignal`. `TComponent` uses this signal to attach event listeners (`{ signal }`).

Without it, if you remove a component from the DOM, its event listeners will remain in memory, potentially causing memory leaks.

```typescript
const controller = new AbortController();
const app = new App({ signal: controller.signal });

// Later, when destroying the app:
controller.abort(); // Automatically removes all 'on*' event listeners!
app.element.remove();
```

### SVG & MathML CamelCase Tags Limitation

`TComponent` parses HTML strings natively using `document.createElement('template').innerHTML` to keep the library zero-dependency and tiny.

However, the browser's HTML parser **forces all tags to lowercase**. While `TComponent` correctly assigns the SVG/MathML namespaces, certain SVG tags that require camelCase (e.g., `<linearGradient>`, `<clipPath>`) will be parsed as `<lineargradient>`.

Because of this browser limitation, **complex SVGs with camelCase tags might not render correctly when written directly inside `static template`**.
For complex SVGs, it is recommended to insert them manually via DOM manipulation in the constructor, or load them externally.

## 7. Strict TypeScript Typing for `idMap`

By default, elements retrieved from `this.idMap` are typed as `Element | AbstractComponent`, requiring you to use type assertions (e.g., `as HTMLInputElement`) to access specific DOM properties.

While this keeps the component definition simple, you might prefer strict, automatic type inference for your mapped IDs. `TComponent` supports a second generic type parameter that allows you to define the exact shape of your `idMap`.

### Example: Strongly Typed ID Map and Encapsulation

By defining an interface for your IDs and passing it to `TComponent`, your editor will provide full auto-completion for ID strings, and automatically infer the correct DOM element or Component types—eliminating the need for repetitive `as` assertions.

```typescript
import TComponent, { ComponentParams, kebabKeys } from '@user/tcomponent';

class CustomAvatar extends TComponent<HTMLImageElement> {
  static template = /* HTML */ `<img class="avatar" />`;

  // Best Practice: Expose explicit methods to update internal state,
  // rather than letting external components mutate `this.element` directly.
  setSrc(url: string) {
    this.element.src = url;
  }
}

// 1. Define an interface mapping your exact IDs to their expected types
interface ProfileIdMap {
  'profile-title': HTMLHeadingElement;
  'username-input': HTMLInputElement;
  'submit-btn': HTMLButtonElement;
  'user-avatar': CustomAvatar; // Works perfectly with custom sub-components!
}

// 2. Pass the interface as the second generic parameter
class UserProfile extends TComponent<HTMLFormElement, ProfileIdMap> {
  static uses = kebabKeys({ CustomAvatar });

  static template = /* HTML */ `
    <form>
      <h2 id="profile-title">Edit Profile</h2>
      <custom-avatar id="user-avatar"></custom-avatar>
      <input id="username-input" type="text" />
      <button id="submit-btn" type="submit">Save</button>
    </form>
  `;

  constructor(params: ComponentParams) {
    super(params);

    // Fully typed! No `as HTMLInputElement` required.
    // Your IDE will auto-complete 'username-input' and know it's an HTMLInputElement.
    const input = this.idMap['username-input'];
    input.value = 'JohnDoe';

    const btn = this.idMap['submit-btn'];
    btn.disabled = false;

    // Custom component methods are strongly typed and auto-completed
    const avatar = this.idMap['user-avatar'];
    avatar.setSrc('/path/to/image.png');
  }
}
```

**Benefits of this approach:**

- **Zero runtime cost:** It's purely for TypeScript DX.
- **Refactoring safety:** If you change an ID string in the interface, TypeScript will flag any outdated strings used inside `this.idMap['...']`.
- **Intellisense:** Immediate auto-completion of all available IDs and public methods of custom components.
