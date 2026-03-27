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
- **Easy Cleanup**: Simply call `.destroy()` to safely remove the component from the DOM and automatically unbind all event listeners. Cleanup automatically cascades down to all nested child components to prevent memory leaks.

## Installation

```bash
npm install @haiix/tcomponent
```

## Quick Start

```typescript
import TComponent from '@haiix/tcomponent';

class CounterApp extends TComponent<HTMLElement> {
  static template = /* HTML */ `
    <section class="counter-app">
      <h1 id="count-display">0</h1>

      <!-- Attributes beginning with "on" bind events to component methods -->
      <button onclick="handleIncrement">Increment</button>
    </section>
  `;

  // The original "id" is replaced with a UUID, accessible via this.idMap
  countDisplay = this.idMap['count-display'] as HTMLHeadingElement;

  // State is managed explicitly by you, not the framework
  count = 0;

  handleIncrement(event: MouseEvent) {
    this.count++;
    // Explicit, non-reactive DOM manipulation
    this.countDisplay.textContent = this.count.toString();
  }

  // Errors thrown in events (sync or async) bubble up and are caught here
  onerror(error: unknown) {
    console.error('An error occurred:', error);
  }
}

// 1. Instantiate the component
const app = new CounterApp();

// 2. Mount to the DOM
document.body.appendChild(app.element);

// To safely destroy the component (removes from DOM and clears event listeners):
// app.destroy();
```

## Tips: Editor Support & Formatting

Since `TComponent` uses standard template literals for HTML, you can drastically improve your Developer Experience (DX) by prefixing your templates with the `/* HTML */` comment.

```typescript
static template = /* HTML */ `
  <div>Hello World</div>
`;
```

- **Prettier**: Automatically recognizes the `/* HTML */` comment and will format the inner string as HTML.
- **VSCode**: By installing extensions like [es6-string-html](https://marketplace.visualstudio.com/items?itemName=Tobermory.es6-string-html), you get rich HTML syntax highlighting directly inside your TypeScript files.

## Documentation / Advanced Usage

TComponent is designed to be simple, but it packs powerful features for complex applications. Check out the detailed documentation below:

https://haiix.github.io/TComponent/modules.html

## License

[MIT](LICENSE)
