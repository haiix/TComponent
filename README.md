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

## Documentation / Advanced Usage

TComponent is designed to be simple, but it packs powerful features for complex applications. Check out the detailed documentation below:

https://github.com/haiix/TComponent/wiki

## License

[MIT](LICENSE)
