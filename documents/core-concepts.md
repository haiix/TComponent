---
title: Core Concepts
---

# Core Concepts

Welcome to the foundational guide for `TComponent`. While TComponent is simple and non-reactive, its string-based templates and explicit DOM manipulation allow you to build structured, component-based UIs with ease.

This document covers the essentials of defining components, composing UIs, handling props and slots, and DOM event binding.

---

## Installation

To get started with TComponent, install it via your preferred package manager:

```bash
npm install @haiix/tcomponent
```

---

## Defining a Basic Component

At its core, a TComponent is a standard ES6 class that manages a specific portion of the DOM.

Unlike reactive frameworks, TComponent **does not** use a virtual DOM and does not automatically re-render when variables change. Instead, you define a static HTML template once, and explicitly manipulate the DOM elements using standard Web APIs.

When building a component, you will mainly work with the following three core features:

- **`static template`**: A standard HTML string defining your component's structure. It is parsed once per component class and cached for maximum performance.
- **`this.getById(id, ExpectedType?)`**: Any element assigned an `id` in your template is mapped internally and intentionally removed from the DOM to prevent collisions. You can safely access these inner nodes via `this.getById()`.
- **`this.element`**: Every component instance exposes its root DOM node via the `.element` property. Because it is a native `Element`, you mount it to the page using standard methods like `document.body.appendChild()`.

Only registered IDs are returned; an unregistered ID causes `getById()` to throw an error. If an ID appears more than once in the same template, the first target is kept and a warning is logged once.

### Example: A Simple Counter

Here is how you define, instantiate, and mount a single component by combining these concepts:

```typescript
import TComponent from '@haiix/tcomponent';

// Extend TComponent and specify the root element type (e.g., HTMLElement, HTMLDivElement)
class Counter extends TComponent<HTMLElement> {
  // 1. Define your layout
  static template = /* HTML */ `
    <div class="counter-widget">
      <!-- "count-display" is automatically replaced with a UUID in the DOM -->
      <h2 id="count-display">0</h2>

      <!-- Event bindings are mapped to class methods -->
      <button onclick="handleIncrement">Increment</button>
    </div>
  `;

  // 2. Access internal elements via `this.getById()`
  // Passing the class as the second argument provides automatic typing and runtime safety.
  countDisplay = this.getById('count-display', HTMLHeadingElement);

  // 3. Manage your own state explicitly
  count = 0;

  // 4. Handle events and mutate the DOM directly
  handleIncrement(event: MouseEvent) {
    this.count++;
    // Explicit, direct DOM update
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

### Tips: Editor Support & Formatting

Since TComponent uses standard template literals for HTML, you can improve your Developer Experience (DX) by prefixing your templates with the `/* HTML */` comment.

```typescript
static template = /* HTML */ `
  <div>Hello World</div>
`;
```

- **Prettier**: Automatically recognizes the `/* HTML */` comment and will format the inner string as HTML.
- **VS Code**: By installing extensions like [es6-string-html](https://marketplace.visualstudio.com/items?itemName=Tobermory.es6-string-html), you get rich HTML syntax highlighting directly inside your TypeScript files.

---

## Registering Components

You can compose complex UIs by nesting reusable child components. To use a custom component inside a template, you must explicitly register it using the `static uses` property.

To resemble standard Web Components (using hyphenated tags), use the `kebabKeys` utility. It automatically converts `PascalCase` class names into `kebab-case` tag names.

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

## Styling Components (No Shadow DOM)

By default, TComponent deliberately **does not** use Shadow DOM. All elements rendered by your components exist in the standard, global light DOM.

This means you can easily style your application using global stylesheets, utility-first CSS frameworks (like Tailwind CSS), or CSS Modules without worrying about style encapsulation blocking your rules. To prevent styling conflicts, it is highly recommended to use a naming convention like BEM (Block Element Modifier).

If you are building a reusable component and need strict CSS encapsulation, you can explicitly opt into Shadow DOM. See [Advanced Usage: Shadow DOM Encapsulation](./advanced.md#shadow-dom-encapsulation) for details.

---

## Passing Props and Slots

When you pass attributes (props) or child nodes (slots) to a custom component in your template, TComponent deliberately **does not** automatically apply them to the child component's root element.

This is an intentional design choice: a component might need to apply certain attributes or inject slot content into a specific internal element rather than the outer wrapper, giving you full, explicit control over the DOM.

### Read-only Template Inputs

Attributes and slots are read-only inputs. `getParsed()` recursively freezes the shared template AST once per component class: every `TNode`, attribute dictionary (`a`), and child array (`c`) is frozen. The returned cache object and its `uses` dictionary are also frozen; registered component classes and their prototypes remain mutable. Repeated construction reads the same AST without copying it.

To consume a custom attribute, copy the dictionary before deleting it and forward the copy:

```typescript
const attributes = { ...params.attributes };
const value = attributes.value;
delete attributes.value;
applyParams(this, this.element, { ...params, attributes });
```

Copying a slot array with `[...params.childNodes]` lets you add or remove array entries, but its nested nodes still belong to the frozen template. Copy each node, attribute dictionary, and child array you intend to change. See [Explicit Copies for AST Changes](./advanced.md#explicit-copies-for-ast-changes) for a recursive example.

Only library-owned caches are frozen. Caller-supplied parameter objects, external `AbortSignal`s, manually constructed ASTs, and component instances are not frozen by the library; the public input types still describe read-only usage.

### The `applyParams` Utility

The `applyParams` utility primarily forwards received attributes (like `class` or `style`) and child nodes (slots) once during initialization, usually in the constructor. The target can be the component's root element or a specific internal element.

It appends child nodes, adds classes and style declarations, binds events (`on*`) to the parent's methods, and ignores internal attributes like `id`.

Forwarded attribute names are normalized for the receiving element's namespace and document: HTML elements in HTML documents use lowercase names, while SVG, MathML, and XML documents preserve case. For example, `viewBox` becomes `viewbox` on an HTML target and stays `viewBox` on an SVG target. This differs from `BuildContext`, where manually created or copied ASTs must already use the correct names. Slot child ASTs also follow that input contract. See [Names in Manual ASTs](./advanced.md#names-in-manual-asts) for details and examples.

ID reference attributes such as `for` and `aria-labelledby` are resolved in the parent's template scope after the parent finishes building, including references to later siblings or slotted elements. Without a `TComponent` parent, they use the receiving component's context. If you call `applyParams()` after that context's build-time resolution, call its `context.resolveIdReferences()` after applying parameters and building the reference targets.

#### Reapplying Parameters and Updating State

You can also call `applyParams()` after construction. Each call applies the following operations to the target:

| Input                    | Behavior on reapplication                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Ordinary attributes      | Overwrite supplied attributes. Omitted attributes are not removed.                                                 |
| `class`                  | Add tokens to `classList`. Identical tokens do not duplicate; existing classes are not removed.                    |
| `style`                  | Append style declarations. Previous declarations are not removed; the resulting appearance follows CSS precedence. |
| Event attributes (`on*`) | Add new listeners. Previous listeners are not replaced.                                                            |
| Child nodes              | Append children. Existing children are not replaced.                                                               |

Reapplying the same event attribute to the same element adds another listener even if the method name is unchanged. A single event then invokes the method multiple times. Styles and children also accumulate, so applying the same params repeatedly does not preserve the same state. **Do not use whole-params reapplication as a state update mechanism.**

For updates after construction, explicitly manipulate DOM attributes, `classList`, `style`, and child nodes, or call the component's public methods. To change an existing event handler's behavior, replace the implementation of the named method on the component providing the handler (usually the parent), or let that method branch on the component's current state. Event wrappers resolve the method at execution time, so neither approach requires reapplying `applyParams()`.

When extending a component, avoid forwarding the same params again to a target that the base class already handled. See [Best Practices: Root Element Constraints](./best-practices.md#root-element-constraints-composition-vs-inheritance) for the inheritance context.

### Example: A Reusable Card Component

```typescript
import TComponent, {
  type ComponentParams,
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
    const target = this.getById('card-body', HTMLDivElement);

    // 2. Forward the received attributes and slots once during initialization
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

TComponent solves this automatically. When an element is assigned an `id`, it is mapped internally and removed from the DOM. However, if that ID is referenced by accessibility attributes—such as `for`, `aria-labelledby`, or `aria-controls`—TComponent detects this and automatically generates and injects a **UUID** strictly where needed, perfectly resolving the references.

```typescript
import TComponent from '@haiix/tcomponent';

class AccessibleForm extends TComponent<HTMLFormElement> {
  static template = /* HTML */ `
    <form>
      <!-- TComponent detects the 'for' reference. -->
      <!-- It dynamically generates a UUID for "my-input" and updates both elements. -->
      <label for="my-input">Username:</label>
      <input id="my-input" aria-describedby="desc" type="text" />
      <br />
      <span id="desc">Please enter your full name.</span>
    </form>
  `;
}
```

_Note: If an ID reference contains multiple space-separated IDs, TComponent correctly resolves all of them._

Local fragments in `href="#section"` and `xlink:href="#shape"` also resolve automatically. On SVG elements, local `url(#id)` references in `fill`, `stroke`, `filter`, `clip-path`, `mask`, `marker`, `marker-start`, `marker-mid`, and `marker-end` use the same ID mapping. Quoted forms such as `url("#shape")` and `url('#shape')` are supported; whitespace, quotes, and fallback values are preserved. External URLs and unresolved references remain unchanged. References inside `style` attributes or `<style>` content are not resolved.

These fragment and SVG URL references also work through `applyParams()`, following the parent scope and deferred resolution rules described below.

### Component Boundaries and the Power of Slots

In TComponent, ID generation and reference resolution (`for`, `aria-controls`, etc.) are strictly bounded to the **same component's template**.

This also applies to attributes passed to custom components through `applyParams()`: a parent template's `<label-comp for="input">` can reference the parent's native `<input id="input">`, even if the label attribute is applied to an internal child element. The reference still uses the parent's scope; it cannot access IDs defined in the child's own template. Unknown IDs and IDs assigned to custom component instances remain unchanged.

If you assign an `id` to a custom sub-component (e.g., `<custom-input id="my-child">`), TComponent deliberately **does not** apply this ID to the child's root HTML element. This prevents unexpected DOM behaviors, such as a parent's `<label>` pointing to a layout wrapper `<div>` instead of the actual `<input>` hidden inside the child component.

### Best Practice: Inversion of Control with Slots

If you need to link a `<label>` in a parent component to an `<input>` managed by a child component, the most robust approach is to use **Slots**.

Because slot content is evaluated in the **parent's scope**, elements passed via slots share the same id as the parent. This ensures that their UUIDs resolve perfectly.

Slot content passed through `applyParams()` also resolves event handler methods and `static uses` in the parent's scope. Its lifecycle follows the component receiving the slot: destroying that component unbinds slot events and aborts the signals of custom components inside the slot, including nested slots. The parent and sibling components remain active. Slotted custom components retain their `parent` reference for parameter resolution and error propagation.

```typescript
import TComponent, {
  type ComponentParams,
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
    applyParams(this, this.getById('inner-container', Element), params);
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

TComponent binds events by parsing the `on*` attributes in your template. To keep your templates clean and modern, the recommended syntax is to simply provide the method name:

```html
<button onclick="handleSubmit">Submit</button>
```

### Native HTML Compatibility

To make migrating existing Vanilla HTML templates seamless, TComponent securely parses and allows native-like event handler syntaxes.

It is important to understand that **all of the following examples are semantically identical**. They do not change how the event is executed; TComponent simply extracts the target method name (`handleSubmit`) and binds it via `addEventListener`.

- `onclick="handleSubmit"`
- `onclick="this.handleSubmit"`
- `onclick="handleSubmit(event)"`
- `onclick="this.handleSubmit(event);"`
- `onclick="return handleSubmit()"`

_Note: Behind the scenes, TComponent uses a strict regex to safely extract just the method name. It does not use `eval()`, meaning the presence of `return` or `(event)` in the attribute has no effect on the actual execution. The method will always receive the `Event` object as its first argument._

### Security Validation

For security reasons, event handlers must strictly match a valid JavaScript identifier (method name). If you attempt to write raw JavaScript logic (e.g., `onclick="console.log(event)"` or `onclick="alert('XSS')"`), TComponent will throw a `SecurityError` during initialization, preventing arbitrary inline execution.

---

## Preventing Default Actions

In native HTML, returning `false` from an inline event handler cancels the browser's default action. TComponent replicates this behavior.

If your bound method explicitly returns exactly `false`, TComponent will automatically call `event.preventDefault()` for you.

_Note: This depends entirely on what your method returns in TypeScript/JavaScript, not on whether you wrote `return` in the HTML attribute._

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
