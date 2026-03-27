---
title: Advanced Usage
---

# Advanced Usage & Internals

Underneath its simple API, `TComponent` packs powerful capabilities for complex applications, SPA routing, and extreme performance optimization. This guide is intended for developers looking to push the boundaries of explicit DOM manipulation.

This document dives deep into advanced memory management using external `AbortSignal`s, strict TypeScript typing for internal elements, dynamic AST (`TNode`) manipulation, and building purely manual components via `AbstractComponent`.

---

## Advanced Memory Management: External AbortSignals

As explained in [Component Lifecycle & Teardown](./architecture.md#component-lifecycle-teardown), calling `.destroy()` automatically cleans up a component and its children via internal `AbortController`s.

However, if you are building a larger application (like an SPA router) where multiple components share the exact same lifecycle, manually calling `.destroy()` on every root component when a route changes can become tedious. To solve this, you can pass an external `AbortSignal` into the top-level component's constructor.

### Passing an External Signal

By passing a signal, you link the component's lifecycle to an external controller. When the controller aborts, the component is automatically destroyed.

```typescript
const routerController = new AbortController();

// Pass the router's signal to the top-level page component
const page = new UserListApp({ signal: routerController.signal });

// When the user navigates away, aborting the router
// automatically destroys the entire page tree and unbinds all events.
routerController.abort();
```

### Intelligent Garbage Collection (GC)

When linking lifecycles via external signals, a common trap in vanilla JavaScript is accidentally creating memory leaks by leaving references to destroyed child components inside a long-lived parent's `AbortSignal`.

`TComponent` is intelligently designed to prevent this. If a child component is manually `.destroy()`ed before its parent (for example, a user deletes a single item from a list), `TComponent` automatically removes the child's abort listener from the parent's signal.

This ensures proper Garbage Collection (GC) and guarantees that no memory leaks or hanging references remain attached to the parent, even in highly dynamic, long-lived applications.

---

## Strict TypeScript Typing for `idMap`

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

  constructor(params?: ComponentParams) {
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

## AbstractComponent vs. TComponent

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
import { AbstractComponent, ComponentParams } from '@haiix/tcomponent';

class ManualComponent extends AbstractComponent {
  element: HTMLDivElement;

  constructor(params?: ComponentParams) {
    super(params); // Sets up 'this.parent' and error bubbling

    // Completely manual DOM construction
    this.element = document.createElement('div');
    this.element.className = 'manual-box';
    this.element.textContent = 'I have no static template!';
  }
}
```

---

## Advanced AST Manipulation (Dynamic Templates)

Because `TComponent` compiles templates into a lightweight AST (`TNode`), you don't have to render child nodes immediately. You can capture a child node's AST and use it as a **reusable template** to generate new DOM nodes dynamically.

### Example: A Generic Dynamic List

In this advanced example, a `DynamicList` component captures its first child as an AST template (e.g., an `<li>`), and re-evaluates that AST whenever a new item is added.

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
