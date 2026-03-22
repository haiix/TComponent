# TComponent: Advanced Usage & Documentation

While `TComponent` is designed to be incredibly simple and non-reactive, its architecture—based on parsing HTML into an Abstract Syntax Tree (AST) called `TNode`—allows for highly advanced, flexible, and explicit UI patterns.

This document covers detailed usage, composition strategies, and edge cases.

---

## 1. Component Composition

You can compose complex UIs by registering child components using the `static uses` property. The key in this object determines the HTML tag name you will use in your template (case-insensitive).

To make your templates look like standard HTML Web Components (using hyphenated tags), you can use the `kebabKeys` utility.

### Important Note on Props and Slots

In `TComponent`, attributes (props) and child nodes (slots) passed to a sub-component are **not** automatically applied to its root element.

This is a deliberate design choice: a component might need to apply certain attributes to a specific internal element rather than the root, ensuring you have complete, explicit control over the DOM.

### The `applyParams` Utility

While you can manually parse `params.attributes` and `params.childNodes` in the constructor, `TComponent` provides a powerful `applyParams` utility to seamlessly route props and slots to any target element.

`applyParams` intelligently handles:

- **Merging**: Safely merges `class` and `style` attributes without overwriting existing ones on the target element.
- **Security**: Automatically skips `id` and `on*` (event) attributes, preventing global ID collisions and invalid inline event handlers on the component's internal DOM.
- **Slot Scope Isolation**: Automatically builds child AST nodes (`TNode`) within the **parent component's context**. This means event listeners inside slots correctly bind to the parent's methods, and any new IDs inside the slot are merged directly into the **parent's `idMap`**.

### Example: Composing Components with Utilities

```typescript
import TComponent, {
  ComponentParams,
  kebabKeys,
  applyParams,
} from '@haiix/tcomponent';

class ChildComponent extends TComponent<HTMLDivElement> {
  static template = /* HTML */ `
    <div class="card-wrapper">
      <!-- We want to inject props and slots directly into this inner element -->
      <div
        id="card-body"
        class="base-card"
        style="border: 1px solid #ccc;"
      ></div>
    </div>
  `;

  constructor(params: ComponentParams) {
    super(params);

    // 1. Get the target internal element
    const target = this.idMap['card-body'] as HTMLDivElement;

    // 2. Safely apply all passed attributes and child nodes (slots) to it
    applyParams(this, target, params);
  }
}

class ParentComponent extends TComponent<HTMLDivElement> {
  // kebabKeys automatically transforms { ChildComponent }
  // into { 'child-component': ChildComponent }
  static uses = kebabKeys({ ChildComponent });

  static template = /* HTML */ `
    <div>
      <h2>Parent Dashboard</h2>

      <!-- The component is now accessible via standard kebab-case -->
      <child-component class="extra-padding" style="background: #f9f9f9;">
        <!-- This slot element belongs to the Parent's scope -->
        <button id="slot-btn" onclick="handleSlotClick">
          Dynamic Slot Button
        </button>
      </child-component>
    </div>
  `;

  constructor(params: ComponentParams) {
    super(params);

    // Because applyParams merges slot IDs into the parent's scope,
    // you can access elements inside the slot directly from the parent!
    const btn = this.idMap['slot-btn'] as HTMLButtonElement;
  }

  handleSlotClick() {
    console.log(
      'Slot button clicked! This correctly runs in the Parent scope.',
    );
  }
}
```

---

## 2. AbstractComponent vs. TComponent

`TComponent` is actually a feature-rich subclass of a much simpler base class called `AbstractComponent`.

- **`TComponent`**: Provides the high-level API you use most of the time. It automatically parses the `static template` into an AST, builds the DOM, resolves ID references (`idMap`), binds events, and provides the `destroy()` method.
- **`AbstractComponent`**: The minimal, bare-bones foundation. It only provides the component tree structure (the `parent` reference) and the error bubbling mechanism (`onerror`). It does **not** handle HTML templates, event binding, or automatic teardown. It requires you to explicitly define and construct the `element` property yourself.

### When should you use `AbstractComponent` directly?

You should extend `AbstractComponent` instead of `TComponent` when:

1. You don't need a static HTML template (e.g., generating DOM entirely via `document.createElement`).
2. You want absolute maximum performance by skipping the template parsing phase entirely.
3. You are building highly specialized structural components—such as loops, conditionals, or dynamic slots—that manipulate the raw AST (`TNode`) directly.

**Example of a purely manual component:**

```typescript
import { AbstractComponent, ComponentParams } from '@haiix/tcomponent';

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
  type TNode,
  type ComponentParams,
  AbstractComponent,
  BuildContext,
  kebabKeys,
} from '@haiix/tcomponent';

/**
 * A generic dynamic list component that uses its child AST as a template.
 */
class DynamicList extends AbstractComponent {
  element: Element;
  private context: BuildContext;
  private templateNode: TNode;

  constructor(params: ComponentParams) {
    super(params);

    if (!params.parent || !params.childNodes?.length) {
      throw new Error(
        'DynamicList requires a parent component and exactly one child template.',
      );
    }

    // 1. Dynamically create the root element's AST (defaulting to <ul>) and build it.
    const tagName = params.attributes?.tagname || 'ul';
    const rootAst: TNode = { t: tagName, a: { ...params.attributes }, c: [] };
    delete rootAst.a.tagname; // Clean up custom props

    // Safely retrieve custom components registered in the parent
    let parentUses: Record<string, typeof AbstractComponent> = {};
    if (params.parent instanceof TComponent) {
      const ParentClass = params.parent.constructor as typeof TComponent;
      parentUses = ParentClass.getParsed().uses;
    }

    this.context = new BuildContext(params.parent, parentUses, params.signal);
    this.element = this.context.build(rootAst);

    // 2. Save the child element (Slot) as a reusable list-item template
    const childTNode = params.childNodes[0];
    if (!childTNode || typeof childTNode === 'string') {
      throw new Error(
        'DynamicList template must be an HTML element, not plain text.',
      );
    }
    this.templateNode = childTNode;
  }

  /**
   * Appends a new item by re-evaluating the saved AST template.
   */
  append(childContent: string | Node) {
    // Generate new DOM elements from the saved AST template
    const li = this.context.build(this.templateNode);

    // Insert content and append to the list
    li.append(childContent);
    this.element.append(li);
  }
}

// --- Usage ---

class App extends TComponent {
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
import TComponent from '@haiix/tcomponent';

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

### Component Boundaries and ID Resolution

In `TComponent`, ID generation and reference resolution (`for`, `aria-controls`, etc.) are strictly bounded to the **same component's template**.

If you assign an `id` to a custom sub-component (e.g., `<custom-input id="my-child">`), `TComponent` deliberately **does not** implicitly apply this ID to the child component's root HTML element.

This strict encapsulation is highly intentional. It prevents unexpected DOM behaviors, such as a parent's `<label>` accidentally pointing to a layout wrapper `<div>` instead of the actual `<input>` hidden deep inside the child component.

### The Best Practice: Using Slots for Accessibility

If you need to link a `<label>` in a parent component to an `<input>` managed by a child component, the most robust and explicit approach is to use **Slots**.

Because `applyParams` evaluates slot elements within the **parent's scope**, both the `<label>` and the `<input>` will share the same `idMap`. This allows their UUIDs to resolve perfectly, even though the input is visually wrapped by the child component.

```typescript
import TComponent { ComponentParams, kebabKeys, applyParams } from '@haiix/tcomponent';

class InputWrapper extends TComponent<HTMLDivElement> {
  static template = /* HTML */ `
    <div class="input-group">
      <!-- The slot content (e.g., the input) will be visually injected here -->
      <div id="inner-container" class="styled-box"></div>
    </div>
  `;

  constructor(params: ComponentParams) {
    super(params);
    // Safely route child nodes (slots) into the internal container
    applyParams(this, this.idMap['inner-container'] as Element, params);
  }
}

class ParentForm extends TComponent<HTMLFormElement> {
  static uses = kebabKeys({ InputWrapper });

  static template = /* HTML */ `
    <form>
      <!-- Both the label and the input exist in the Parent's scope, -->
      <!-- so the 'for' attribute successfully finds 'username-input'. -->
      <label for="username-input">Username:</label>

      <input-wrapper>
        <!-- The input is passed as a slot -->
        <input id="username-input" type="text" placeholder="Enter name..." />
      </input-wrapper>
    </form>
  `;
}
```

**Why this pattern is powerful (Inversion of Control):**
Instead of the child component (`InputWrapper`) having to accept dozens of props (`type`, `placeholder`, `required`, `onchange`) just to manually pass them down to an internal `<input>`, the parent retains full, explicit control over the actual input element. The `InputWrapper` focuses solely on what it does best: providing layout, styling, and structural encapsulation.

---

## 5. Error Boundaries and Bubbling

If an event listener throws an error (or a Promise rejects), `TComponent` catches it and calls the `onerror` method. If the current component does not override `onerror` or explicitly throws the error again, the error bubbles up to the parent component.

This allows you to create top-level "Error Boundary" components to handle UI failures gracefully.

```typescript
class Child extends TComponent {
  static template = /* HTML */ `
    <button onclick="doAction">Throw Error</button>
  `;

  async doAction() {
    // Both synchronous errors and unhandled Promise rejections are caught
    throw new Error('Something went wrong in the child!');
  }
}

class Parent extends TComponent {
  static uses = { Child };
  static template = /* HTML */ ` <div><child></child></div> `;

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

### SVG & MathML CamelCase Tags Limitation

`TComponent` parses HTML strings natively using `document.createElement('template').innerHTML` to keep the library zero-dependency and tiny.

However, the browser's HTML parser **forces all tags to lowercase**. While `TComponent` correctly assigns the SVG/MathML namespaces, certain SVG tags that require camelCase (e.g., `<linearGradient>`, `<clipPath>`) will be parsed as `<lineargradient>`.

Because of this browser limitation, **complex SVGs with camelCase tags might not render correctly when written directly inside `static template`**.
For complex SVGs, it is recommended to insert them manually via DOM manipulation in the constructor, or load them externally.

---

## 7. Strict TypeScript Typing for `idMap`

By default, elements retrieved from `this.idMap` are typed as `Element | AbstractComponent`, requiring you to use type assertions (e.g., `as HTMLInputElement`) to access specific DOM properties.

While this keeps the component definition simple, you might prefer strict, automatic type inference for your mapped IDs. `TComponent` supports a second generic type parameter that allows you to define the exact shape of your `idMap`.

### Example: Strongly Typed ID Map and Encapsulation

By defining an interface for your IDs and passing it to `TComponent`, your editor will provide full auto-completion for ID strings, and automatically infer the correct DOM element or Component types—eliminating the need for repetitive `as` assertions.

```typescript
import TComponent, { ComponentParams, kebabKeys } from '@haiix/tcomponent';

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


---

## 8. Component Lifecycle & Teardown

Managing event listeners in vanilla JavaScript can often lead to memory leaks if elements are removed from the DOM but their listeners remain active. `TComponent` handles this gracefully via internal `AbortController`s.

### The `destroy()` Method

Every `TComponent` instance comes with a built-in `destroy()` method. Calling this method will:
1. Remove the component's root element from the DOM (`this.element.remove()`).
2. Instantly unbind all event listeners defined via `on*` attributes.
3. Automatically cascade the teardown process to all nested sub-components.

```typescript
const app = new CounterApp();
document.body.appendChild(app.element);

// Later, when the app needs to be removed:
app.destroy(); // DOM is cleared, and all events are unlinked!
```

### Passing External AbortSignals

If you are building a larger application (like an SPA router) where multiple components share the same lifecycle, you can pass an external `AbortSignal` into the component's constructor. When the external signal aborts, it will automatically trigger the component's internal teardown.

```typescript
const routerController = new AbortController();

// Pass the router's signal to the component
const page = new UserProfile({ signal: routerController.signal });

// When the user navigates away, aborting the router automatically destroys the page
routerController.abort();
```

*Note: `TComponent` intelligently manages event listeners to ensure that if a child component is manually `.destroy()`ed before its parent, no memory leaks or hanging references remain attached to the parent's signal.*

---

## 9. Component Communication

`TComponent` is intentionally completely unopinionated about how components communicate with each other. It does not force you into a specific prop-drilling or event-emitting system. You can choose the approach that best fits your project's architecture.

Here are a few standard patterns you can use:

### Approach A: Native DOM Events (CustomEvents)

For child-to-parent communication, you can dispatch standard HTML `CustomEvent`s from the child's root element. The parent can listen to these natively.

```typescript
class Child extends TComponent {
  static template = /* HTML */ `
    <button onclick="notifyParent">Click</button>
  `;

  notifyParent() {
    // Dispatch a standard CustomEvent bubbling up the DOM tree
    this.element.dispatchEvent(
      new CustomEvent('child-clicked', {
        detail: { value: 123 },
        bubbles: true,
      }),
    );
  }
}
```

### Approach B: Explicit Callback Props

You can pass callback functions down to children using manual assignment or by calling public methods on the child component instance.

```typescript
class Parent extends TComponent {
  static uses = { Child };
  static template = /* HTML */ `<child id="my-child"></child>`;

  constructor(params: ComponentParams) {
    super(params);
    const child = this.idMap['my-child'] as Child;

    // Explicitly assign a callback to the child instance
    child.onAction = (data) => console.log('Data from child:', data);
  }
}
```

### Approach C: External State / PubSub

Because `TComponent` components are just standard ES6 classes managing DOM nodes, they play perfectly with external state managers (like Redux, Zustand, or simple Observables/EventEmitters). You can subscribe to external state within your component's constructor and explicitly update the DOM when state changes.
