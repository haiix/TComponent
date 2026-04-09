# TComponent

**Tiny. Typed. Transparent.**

No virtual DOM. No reactivity. No hidden magic.

Just components with explicit, direct DOM control.

---

`TComponent` is a zero-dependency TypeScript component system designed for developers who want full control over how their UI works.

## Features

- **Non-reactive by Design**: Unlike reactive frameworks, TComponent does not automatically update the DOM when state changes. It embraces explicit, vanilla DOM manipulation, keeping the mental model simple and transparent.
- **String-based Templates**: Write declarative HTML templates that are parsed and cached once per component class.
- **Automatic Event Binding**: Bind class methods to DOM events using `on*` attributes. Supports both synchronous and asynchronous functions.
- **Built-in Error Handling**: Errors thrown in event listeners propagate through the component tree and can be handled via a unified `onerror` method.
- **Unique ID Generation**: Element `id` attributes are automatically replaced with UUIDs to prevent global DOM collisions, while remaining easily accessible via `this.getById()`.
- **Automatic ID Reference Resolution**: Attributes like `for`, `aria-labelledby`, and `aria-controls` automatically resolve to the newly generated UUIDs, maintaining accessibility.
- **Component Composition**: Compose reusable sub-components using the `static uses` property.
- **Lifecycle Cleanup**: Call `.destroy()` to safely remove the component from the DOM and automatically unbind all event listeners. The cleanup process automatically cascades to all nested child components, preventing memory leaks.

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

  // Access internal elements or sub-components.
  // Passing a class as the second argument provides automatic typing and runtime safety.
  countDisplay = this.getById('count-display', HTMLHeadingElement);

  // State is managed explicitly by the developer, not by the framework
  count = 0;

  handleIncrement(event: MouseEvent) {
    this.count++;
    // Explicit, non-reactive DOM manipulation
    this.countDisplay.textContent = this.count.toString();
  }

  // Errors thrown in events (sync or async) propagate and are caught here
  onerror(error: unknown) {
    console.error('An error occurred:', error);
  }
}

// 1. Instantiate the component
const app = new CounterApp();

// 2. Mount to the DOM
document.body.appendChild(app.element);

// To destroy the component safely (which removes it from the DOM and clears event listeners):
// app.destroy();
```

## Tips: Editor Support & Formatting

Since TComponent uses standard template literals for HTML, you can improve your Developer Experience (DX) by prefixing your templates with the `/* HTML */` comment.

```typescript
static template = /* HTML */ `
  <div>Hello World</div>
`;
```

- **Prettier**: Automatically recognizes the `/* HTML */` comment and will format the inner string as HTML.
- **VS Code**: By installing extensions like [es6-string-html](https://marketplace.visualstudio.com/items?itemName=Tobermory.es6-string-html), you get rich HTML syntax highlighting directly inside your TypeScript files.

## Documentation / Advanced Usage

TComponent is designed to be simple, but it provides useful features for complex applications. See the detailed documentation below:

https://haiix.github.io/TComponent/modules.html

## License

[MIT](LICENSE)
