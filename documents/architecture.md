# Architecture & Component Communication

Building scalable applications with `TComponent` requires a solid understanding of how components interact and manage their lifecycles. By embracing the DOM as the "Single Source of Truth," you can orchestrate complex UIs without the overhead of complex state management.

This document covers component teardown, dynamic instantiation, error boundaries, event delegation, and explicit strategies for communication between components.

---

## Component Lifecycle & Teardown

Managing event listeners in vanilla JavaScript can often lead to memory leaks if elements are removed from the DOM but their listeners remain active. `TComponent` handles this gracefully behind the scenes.

Every `TComponent` instance comes with a built-in `destroy()` method. Calling this method is the standard and safest way to remove a component. It will automatically perform the following steps:

1. **Remove from DOM:** The component's root element is detached from the document (`this.element.remove()`).
2. **Unbind Events:** Instantly unbind all event listeners defined via `on*` attributes in your template.
3. **Cascade Teardown:** Automatically cascade the teardown process to all nested child components, ensuring no memory leaks remain.

```typescript
const app = new App();
document.body.appendChild(app.element);

// Later, when the app needs to be entirely removed:
// This will safely remove the app from the DOM, unbind its listeners,
// and recursively destroy all child components inside it!
app.destroy();
```

By simply calling `.destroy()`, you ensure that your application remains fast and memory-safe, without needing to manually call `removeEventListener` for every single element.

_(For advanced use cases like SPA routers or external signals, see [Advanced Memory Management: External AbortSignals](./advanced.md#advanced-memory-management-external-abortsignals).)_

---

## Retrieving Components from the DOM

`TComponent` embraces the DOM as the "Single Source of Truth." Instead of maintaining a complex virtual component tree, it provides a built-in `static from(element)` method. This allows you to instantly retrieve the component instance associated with a specific DOM node.

This is extremely useful when you need to interact with a component originating from an external script, or when identifying specific items in [a dynamically generated list](#dynamic-component-creation).

### How it works securely

Under the hood, `TComponent` maintains a single, global `WeakMap` that binds root DOM elements to their component instances.

- **Type-safe:** Calling `ComponentClass.from()` automatically checks `instanceof` before returning. This ensures you never accidentally invoke methods on the wrong component type, and TypeScript perfectly infers the return type as `ComponentClass | undefined`.
- **Memory-safe:** Because it relies on a `WeakMap`, when a DOM element is permanently removed and garbage-collected, its component reference is automatically cleared without causing memory leaks.

### Basic Example

```typescript
import TComponent from '@haiix/tcomponent';

class AlertBox extends TComponent<HTMLDivElement> {
  static template = /* HTML */ `<div class="alert">Warning!</div>`;

  dismiss() {
    this.destroy();
  }
}

// Somewhere else in your application...
// 1. You query an element from the DOM
const el = document.querySelector('.alert');

// 2. Retrieve the component instance directly from the DOM element
// 'alert' is strictly typed as AlertBox | undefined
const alert = AlertBox.from(el);

if (alert) {
  // 3. Safely call component methods
  alert.dismiss();
}
```

---

## Dynamic Component Creation

Instead of defining components statically in the template using `uses`, you will often need to create child components dynamically—such as when rendering a list of items fetched from an API, or opening a modal dialog.

When manually instantiating a child component, it is highly recommended to pass down the `parent` and `signal` from the parent component's `context`.

- Passing `parent: this`: Links the child to the parent's Error Boundary (so if the child throws an error, the parent's `onerror` catches it).
- Passing `signal: this.context.signal`: Links the child's lifecycle to the parent. **If the parent is destroyed, the dynamically created child will automatically clean up its own event listeners.**

### Example: Rendering a Dynamic List

```typescript
import TComponent, { ComponentParams } from '@haiix/tcomponent';

class UserCard extends TComponent<HTMLDivElement> {
  static template = /* HTML */ `
    <div class="card">
      <h3 id="name"></h3>
      <button onclick="handleDelete">Delete</button>
    </div>
  `;

  constructor(params: ComponentParams & { userName: string }) {
    super(params);
    const nameEl = this.idMap['name'] as HTMLHeadingElement;
    nameEl.textContent = params.userName;
  }

  handleDelete() {
    // Manually destroy this specific instance and remove it from the DOM
    this.destroy();
  }
}

class UserListApp extends TComponent<HTMLDivElement> {
  static template = /* HTML */ `
    <div>
      <h2>Users</h2>
      <!-- We will inject dynamically created components here -->
      <div id="list-container"></div>

      <button onclick="loadUsers">Load Users</button>
    </div>
  `;

  async loadUsers() {
    const container = this.idMap['list-container'] as HTMLDivElement;

    // [CRITICAL] Memory Leak Prevention
    // Before rendering new children, you MUST destroy existing child components.
    // Simply calling `container.innerHTML = ''` removes elements from the DOM,
    // but leaves their event listeners active and references alive in the parent's AbortSignal!
    for (const childElement of Array.from(container.children)) {
      const card = UserCard.from(childElement);
      if (card) {
        card.destroy();
      }
    }

    const users = ['Alice', 'Bob', 'Charlie'];

    for (const name of users) {
      // 1. Manually instantiate the child component.
      // 2. Pass the parent and the parent's signal so lifecycles and error boundaries are linked.
      const card = new UserCard({
        userName: name,
        parent: this,
        signal: this.context.signal,
      });

      // 3. Manually append the child's element to the DOM
      container.appendChild(card.element);
    }
  }
}
```

---

## Component Communication

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

---

## Error Boundaries and Bubbling

If an event listener throws an error (or a Promise rejects), `TComponent` catches it and calls the `onerror` method. If the current component does not override `onerror` or explicitly throws the error again, the error bubbles up to the `parent` component.

This allows you to create top-level "Error Boundary" components to handle UI failures gracefully.

```typescript
class Child extends TComponent {
  static template = /* HTML */ `<button onclick="doAction">Throw</button>`;

  async doAction() {
    throw new Error('Something went wrong in the child!');
  }
}

class Parent extends TComponent {
  static uses = { Child };
  static template = /* HTML */ `<div><child></child></div>`;

  onerror(error: unknown) {
    console.error('Caught in Parent Error Boundary:', error);
  }
}
```

---

## Performance Optimization: Event Delegation

In vanilla JavaScript, **Event Delegation** is a powerful pattern where you attach a single event listener to a parent element to handle events triggered by its many children. This drastically reduces memory usage compared to attaching individual `onclick` listeners to hundreds of child components.

Because `TComponent` provides the [`static from(element)`](#retrieving-components-from-the-dom), implementing type-safe event delegation is highly intuitive.

### Example: Using `from()` with Event Delegation

Instead of attaching an `onclick` listener to every single `<task-item>`, you can attach one listener to the parent `<ul class="task-list">` and use `event.target` to find the associated child component.

```typescript
import TComponent, { kebabKeys } from '@haiix/tcomponent';

class TaskItem extends TComponent<HTMLLIElement> {
  static template = /* HTML */ `<li class="task-item"></li>`;

  constructor(params: ComponentParams) {
    super(params);
    applyParams(this, this.element, params);
  }

  // Best Practice: State is derived directly from the DOM (Single Source of Truth)
  get isCompleted(): boolean {
    return this.element.style.textDecoration === 'line-through';
  }

  set isCompleted(value: boolean) {
    this.element.style.textDecoration = value ? 'line-through' : 'none';
  }

  toggle() {
    this.isCompleted = !this.isCompleted;
  }
}

class TaskList extends TComponent<HTMLUListElement> {
  static uses = kebabKeys({ TaskItem });

  // Attach a single event listener to the parent <ul>
  static template = /* HTML */ `
    <ul class="task-list" onclick="handleListClick">
      <task-item>Task1</task-item>
      <task-item>Task2</task-item>
      <task-item>Task3</task-item>
    </ul>
  `;

  handleListClick(event: MouseEvent) {
    // 1. Find the closest <li> element that was clicked
    const target = event.target as Element;
    const liElement = target.closest('li.task-item');

    // 2. Retrieve the component instance from the DOM element
    // 'task' is inferred as TaskItem | undefined
    const task = TaskItem.from(liElement);

    if (task) {
      // 3. Explicitly call the component's method
      task.toggle();
    }
  }
}
```
