# TComponent

A tiny, zero-dependency, non-reactive component system written in TypeScript.

Designed for developers who prefer explicit DOM manipulation without the overhead of virtual DOMs or complex state management, while still enjoying a structured, component-based architecture.

## Features

- **Non-reactive by Design**: Unlike modern reactive frameworks, `TComponent` does not automatically update the DOM when state changes. It embraces explicit, vanilla-like DOM manipulation, keeping the mental model incredibly simple and transparent.
- **String-based Templates**: Write declarative HTML templates that are automatically parsed and cached per component class.
- **Automatic Event Binding**: Easily bind class methods to DOM events using `on*` attributes. Supports both synchronous and asynchronous functions.
- **Built-in Error Handling**: Errors thrown inside event listeners bubble up the component tree and can be handled gracefully via a unified `onerror` method.
- **Unique ID Generation**: Element `id`s are automatically converted to UUIDs to prevent global DOM collisions, while remaining easily accessible via `this.idMap`.
- **Automatic ID Reference Resolution**: Attributes like `for`, `aria-labelledby`, and `aria-controls` automatically resolve to the newly generated UUIDs, maintaining accessibility.
- **Component Composition**: Nest reusable sub-components easily using the `static uses` property.
- **Easy Cleanup**: Pass an `AbortSignal` upon instantiation to seamlessly clean up all event listeners when the component is destroyed.

## Installation

```bash
npm install @haiix/tcomponent
```

## Quick Start

```typescript
import TComponent from '@haiix/tcomponent';

class App extends TComponent<HTMLElement> {
  // Tip: Prefixing with /* HTML */ enables syntax highlighting and Prettier formatting!
  static template = /* HTML */ `
    <section>
      <!-- The original "id" is replaced with a UUID, accessible via this.idMap -->
      <h1 id="myOutput">Hello,</h1>

      <!-- Attributes beginning with "on" bind events to component methods -->
      <button onclick="handleMyButton">Click here</button>
    </section>
  `;

  // Bind the uniquely generated DOM element to a class property
  myOutput = this.idMap['myOutput'] as HTMLHeadingElement;

  handleMyButton(event: MouseEvent) {
    // Explicit, non-reactive DOM manipulation
    this.myOutput.textContent += 'World!';
  }

  // Errors thrown in events (sync or async) are caught here
  onerror(error: unknown) {
    console.error('An error occurred:', error);
  }
}

// 1. Create an AbortController to manage component teardown
const controller = new AbortController();

// 2. Instantiate the component and pass the signal
const app = new App({ signal: controller.signal });

// 3. Mount to the DOM
document.body.appendChild(app.element);

// To destroy the component and remove all event listeners:
// controller.abort();
// app.element.remove();
```

## Tips: Editor Support & Formatting

Since `TComponent` uses standard template literals for HTML, you can drastically improve your Developer Experience (DX) by prefixing your templates with the `/* HTML */` comment.

```typescript
static template = /* HTML */ `
  <div>Hello World</div>
`;
```

- **Prettier**: Automatically recognizes the `/* HTML */` comment and will format the inner string as HTML.
- **VSCode**: By installing extensions like [es6-string-html](https://marketplace.visualstudio.com/items?itemName=Tobermory.es6-string-html) or [lit-html](https://marketplace.visualstudio.com/items?itemName=runem.lit-plugin), you get rich HTML syntax highlighting and auto-completion directly inside your TypeScript files.

## Advanced Usage

### Using Sub-components

You can compose complex UIs by registering child components using the `static uses` property. The key is matched against the tag name used in the template (case-insensitive).

```typescript
import TComponent, { ComponentParams } from '@haiix/tcomponent';

class ChildComponent extends TComponent<HTMLDivElement> {
  static template = /* HTML */ `
    <div class="child">I am a child component!</div>
  `;

  constructor(params: ComponentParams) {
    super(params);
  }
}

class ParentComponent extends TComponent<HTMLDivElement> {
  // Register the child component
  static uses = { ChildComponent };

  static template = /* HTML */ `
    <div>
      <h2>Parent Component</h2>
      <!-- Use the registered sub-component -->
      <childcomponent></childcomponent>
    </div>
  `;
}
```

**Note**:

In `TComponent`, attributes (props) and child nodes (slots) passed to a sub-component are **not** automatically applied to its root element. This is a deliberate design choice: a component might need to apply certain attributes to a specific internal element rather than the root, ensuring complete explicit control.

You must manually handle them inside the child component's constructor using `params.attributes` and `params.childNodes`.

### Accessibility and ID References

`TComponent` automatically generates UUIDs for elements with an `id` attribute. It also intelligently updates attributes that reference IDs (such as `for` on labels, or `aria-labelledby`) so that your accessibility tree remains intact without worrying about global ID collisions.

```typescript
class AccessibleForm extends TComponent<HTMLFormElement> {
  static template = /* HTML */ `
    <form>
      <!-- "my-input" becomes a UUID. The label's "for" attribute automatically updates to match it. -->
      <label for="my-input">Username:</label>
      <input id="my-input" type="text" />
    </form>
  `;
}
```

### Error Bubbling

If an event listener throws an error (or a Promise rejects), `TComponent` catches it and calls the `onerror` method. If the current component does not override `onerror` or explicitly throws the error again, the error bubbles up to the parent component.

```typescript
class Child extends TComponent {
  static template = /* HTML */ `
    <button onclick="doAction">Throw Error</button>
  `;

  doAction() {
    throw new Error('Something went wrong in the child!');
  }
}

class Parent extends TComponent {
  static uses = { Child };
  static template = /* HTML */ ` <div><child></child></div> `;

  onerror(error: unknown) {
    // This will catch the error thrown by the Child component
    alert(`Caught in Parent: ${error}`);
  }
}
```

## License

[MIT](LICENSE)
