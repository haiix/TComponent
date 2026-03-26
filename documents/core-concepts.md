# Core Concepts & Templating

Welcome to the foundational guide for `TComponent`. While the system is designed to be incredibly simple and non-reactive, its string-based templates and explicit DOM manipulation allow you to build structured, component-based UIs with ease.

This document covers the essentials of defining components, composing UIs, handling props and slots, and native event binding.

---

## Installation

To get started with `TComponent`, install it via your preferred package manager:

```bash
npm install @user/tcomponent
```

---

## Defining a Basic Component

At its core, a `TComponent` is just a standard ES6 class that manages a specific piece of the DOM.

Unlike modern reactive frameworks, `TComponent` **does not** use a virtual DOM, nor does it automatically re-render when variables change. Instead, you define a static HTML template once, and explicitly manipulate the DOM elements using standard Web APIs.

When building a component, you will primarily work with these three core features:

- **`static template`**: A standard HTML string defining your component's structure. It is parsed exactly once per component class and cached for maximum performance.
- **`this.idMap`**: Any element assigned an `id` in your template is automatically converted to a unique UUID to prevent global DOM collisions. You can instantly and safely access these inner elements via the `this.idMap` dictionary.
- **`this.element`**: Every component instance exposes its root DOM node via the `.element` property. Because it is a native `Element`, you mount it to the page using standard methods like `document.body.appendChild()`.

### Example: A Simple Counter

Here is how you define, instantiate, and mount a single component by putting these concepts together:

```typescript
import TComponent from '@user/tcomponent';

// Extend TComponent and specify the root element type (e.g., HTMLElement, HTMLDivElement)
class Counter extends TComponent<HTMLElement> {
  // 1. Define your layout
  static template = /* HTML */ `
    <div class="counter-widget">
      <!-- "count-display" is automatically replaced with a UUID in the DOM -->
      <h2 id="count-display">0</h2>

      <!-- Event bindings natively map to class methods -->
      <button onclick="handleIncrement">Increment</button>
    </div>
  `;

  // 2. Access internal elements instantly via this.idMap
  countDisplay = this.idMap['count-display'] as HTMLHeadingElement;

  // 3. Manage your own state explicitly
  count = 0;

  // 4. Handle events and mutate the DOM directly
  handleIncrement(event: MouseEvent) {
    this.count++;
    // Explicit, vanilla-like DOM update
    this.countDisplay.textContent = this.count.toString();
  }
}

// --- Mounting to the DOM ---

// Instantiate the component
const counter = new Counter();

// Append the component's root element (.element) directly to the document
document.body.appendChild(counter.element);

/*
 * Note: For brevity, the instantiation and mounting steps
 * (new Component() and appendChild) will be omitted in subsequent examples
 * unless they are specifically part of the topic being discussed.
 */
```

---

## Registering Components

You can compose complex UIs by nesting reusable child components. To use a custom component inside a template, you must explicitly register it using the `static uses` property.

To make your templates look like standard HTML Web Components (using hyphenated tags), use the `kebabKeys` utility. It automatically converts `PascalCase` class names into `kebab-case` tag names.

### Example: Basic Composition

```typescript
import TComponent, { kebabKeys } from '@haiix/tcomponent';

// 1. Define a child component
class AppHeader extends TComponent<HTMLElement> {
  static template = /* HTML */ `
    <header>
      <h1>My Application</h1>
    </header>
  `;
}

// 2. Define the parent component
class App extends TComponent<HTMLElement> {
  // kebabKeys transforms { AppHeader } into { 'app-header': AppHeader }
  static uses = kebabKeys({ AppHeader });

  static template = /* HTML */ `
    <main>
      <!-- The component is now accessible via standard kebab-case -->
      <app-header></app-header>

      <p>Welcome to the dashboard!</p>
    </main>
  `;
}
```

---

## Passing Props and Slots

When you pass attributes (props) or child nodes (slots) to a custom component in your template, `TComponent` deliberately **does not** automatically apply them to the child component's root element.

This is a strict design choice: a component might need to apply certain attributes or inject slot content into a specific internal element rather than the outer wrapper, ensuring you have complete, explicit control over the DOM.

### The `applyParams` Utility

To easily route passed attributes (like `class` or `style`) and child nodes to a specific target element inside your component, `TComponent` provides the `applyParams` utility.

It smartly handles appending child nodes, merges `class` and `style` strings, and safely ignores internal attributes like `id` and `on*`.

### Example: A Reusable Card Component

```typescript
import TComponent, {
  ComponentParams,
  kebabKeys,
  applyParams,
} from '@haiix/tcomponent';

class UiCard extends TComponent<HTMLDivElement> {
  static template = /* HTML */ `
    <div class="card-wrapper" style="background: #eee; padding: 10px;">
      <!-- We want to inject props and slots directly into this inner element, -->
      <!-- rather than the wrapper. -->
      <div id="card-body" class="base-card"></div>
    </div>
  `;

  constructor(params: ComponentParams) {
    super(params);

    // 1. Get the target internal element using its ID
    const target = this.idMap['card-body'] as HTMLDivElement;

    // 2. Safely apply all passed attributes and child nodes (slots) to it
    applyParams(this, target, params);
  }
}

class Dashboard extends TComponent<HTMLElement> {
  static uses = kebabKeys({ UiCard });

  static template = /* HTML */ `
    <section>
      <h2>Dashboard</h2>

      <!-- Passing a custom class, inline style, and text content (slot) -->
      <!-- applyParams will inject these into the inner "card-body" div -->
      <ui-card class="highlight" style="color: blue;">
        Hello, I am the slot content!
      </ui-card>
    </section>
  `;
}
```

---

## Accessibility and ID References

When writing reusable components, managing HTML `id` attributes can be tricky because duplicating IDs across a page breaks accessibility and DOM queries.

`TComponent` solves this automatically. Any element with an `id` attribute is assigned a **randomly generated UUID**. Furthermore, `TComponent` automatically updates reference attributes—such as `for`, `aria-labelledby`, and `aria-controls`—to match the new UUIDs.

```typescript
import TComponent from '@haiix/tcomponent';

class AccessibleForm extends TComponent<HTMLFormElement> {
  static template = /* HTML */ `
    <form>
      <!-- "my-input" becomes a UUID (e.g., '123e4567-...'). -->
      <!-- The label's "for" attribute automatically updates to match it. -->
      <label for="my-input">Username:</label>
      <input id="my-input" aria-describedby="desc" type="text" />
      <br />
      <span id="desc">Please enter your full name.</span>
    </form>
  `;
}
```

_Note: If an ID reference contains multiple space-separated IDs, `TComponent` correctly resolves all of them._

### Component Boundaries and the Power of Slots

In `TComponent`, ID generation and reference resolution (`for`, `aria-controls`, etc.) are strictly bounded to the **same component's template**.

If you assign an `id` to a custom sub-component (e.g., `<custom-input id="my-child">`), `TComponent` deliberately **does not** apply this ID to the child's root HTML element. This prevents unexpected DOM behaviors, such as a parent's `<label>` pointing to a layout wrapper `<div>` instead of the actual `<input>` hidden inside the child component.

### Best Practice: Inversion of Control with Slots

If you need to link a `<label>` in a parent component to an `<input>` managed by a child component, the most robust approach is to use **Slots**.

Because slot content is evaluated in the **parent's scope**, elements passed via slots share the same `idMap` as the parent. This ensures that their UUIDs resolve perfectly.

```typescript
import TComponent, {
  ComponentParams,
  kebabKeys,
  applyParams,
} from '@haiix/tcomponent';

class InputWrapper extends TComponent<HTMLDivElement> {
  static template = /* HTML */ `
    <div class="input-group">
      <!-- The slot content (e.g., the input) will be visually injected here -->
      <div id="inner-container" class="styled-box"></div>
    </div>
  `;

  constructor(params: ComponentParams) {
    super(params);
    // Route child nodes (slots) into the internal container
    applyParams(this, this.idMap['inner-container'] as Element, params);
  }
}

class ParentForm extends TComponent<HTMLFormElement> {
  static uses = kebabKeys({ InputWrapper });

  static template = /* HTML */ `
    <form>
      <!-- Both the label and the input exist in the Parent's scope, -->
      <!-- so the 'for' attribute successfully resolves 'username-input'. -->
      <label for="username-input">Username:</label>

      <input-wrapper>
        <!-- The input is passed as a slot -->
        <!-- You can safely add events or IDs here, acting as the parent -->
        <input id="username-input" type="text" placeholder="Enter name..." />
      </input-wrapper>
    </form>
  `;
}
```

**Why this pattern is powerful (Inversion of Control):**
Instead of the child component (`InputWrapper`) having to accept dozens of props (`type`, `placeholder`, `required`, `onchange`) just to manually pass them down to an internal `<input>`, the parent retains full, explicit control over the actual input element. The `InputWrapper` focuses solely on what it does best: layout, styling, and structural encapsulation.

---

## Event Binding Syntax

`TComponent` binds events by parsing the `on*` attributes in your template. To keep your templates clean and modern, the recommended syntax is to simply provide the method name:

```html
<button onclick="handleSubmit">Submit</button>
```

### Native HTML Compatibility

To make migrating existing Vanilla HTML templates seamless, `TComponent` securely parses and allows native-like event handler syntaxes.

It is important to understand that **all of the following examples are semantically identical**. They do not change how the event is executed; `TComponent` simply extracts the target method name (`handleSubmit`) and binds it via `addEventListener`.

- `onclick="handleSubmit"`
- `onclick="this.handleSubmit"`
- `onclick="handleSubmit(event)"`
- `onclick="this.handleSubmit(event);"`
- `onclick="return handleSubmit()"`

_Note: Behind the scenes, `TComponent` uses a strict regex to safely extract just the method name. It does not use `eval()`, meaning the presence of `return` or `(event)` in the attribute has no effect on the actual execution. The method will always receive the `Event` object as its first argument._

### Security Validation

For security reasons, event handlers must strictly match a valid JavaScript identifier (method name). If you attempt to write raw JavaScript logic (e.g., `onclick="console.log(event)"` or `onclick="alert('XSS')"`), `TComponent` will throw a `SecurityError` during initialization, preventing arbitrary inline execution.

---

## Preventing Default Actions

In native HTML, returning `false` from an inline event handler cancels the browser's default action. `TComponent` perfectly emulates this behavior.

If your bound method explicitly returns exactly `false`, `TComponent` will automatically call `event.preventDefault()` for you. (Note: This depends entirely on what your method returns in TypeScript/JavaScript, not on whether you wrote `return` in the HTML attribute).

```typescript
class LinkComponent extends TComponent {
  static template = /* HTML */ `
    <a href="https://example.com" onclick="handleLinkClick">Click Me</a>
  `;

  handleLinkClick(event: MouseEvent) {
    // Returning exactly 'false' automatically calls event.preventDefault(),
    // preventing the browser from navigating to example.com.
    return false;
  }
}
```
