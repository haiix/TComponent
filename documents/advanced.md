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

## Custom Namespace URIs

By default, `TComponent` automatically infers the correct namespace when the root element of your template is `<svg>` or `<math>`. However, if you want to create a sub-component where the root element is an **internal** SVG or MathML node (e.g., `<polyline>`, `<g>`, or `<path>`), the browser will default to generating a standard HTML element.

To ensure these elements are created with the correct internal representation, you can explicitly define the `static namespaceURI` property on your component.

### Example: Creating an interactive SVG Polyline

```typescript
import TComponent from '@haiix/tcomponent';

class InteractivePolyline extends TComponent<SVGPolylineElement> {
  // 1. Explicitly declare the SVG namespace
  static namespaceURI = 'http://www.w3.org/2000/svg';

  static template = /* HTML */ `
    <polyline
      points="0,0 50,50 100,0"
      fill="none"
      stroke="black"
      stroke-width="5"
      onmouseover="handleHover"
    ></polyline>
  `;

  handleHover() {
    this.element.setAttribute('stroke', 'red');
  }
}

class DrawingBoard extends TComponent<SVGSVGElement> {
  static uses = { InteractivePolyline };

  static template = /* HTML */ `
    <!-- The <svg> tag automatically gets the SVG namespace -->
    <svg width="200" height="200">
      <interactivepolyline></interactivepolyline>
    </svg>
  `;
}
```

_(Note: Keep in mind the browser parser limitation regarding camelCase SVG tags as mentioned in the [Best Practices & Caveats](./best-practices.md#svg-mathml-camelcase-tags-limitation) document. Standard lowercase tags like `polyline` or `path` work perfectly.)_

---

## Strict TypeScript Typing & Runtime Safety for `getById`

By default, elements retrieved via `this.getById('some-id')` are typed as `Element | AbstractComponent`. In standard TypeScript, you would normally need to use type assertions (e.g., `as HTMLInputElement`) to access specific DOM properties or custom component methods.

To provide a superior Developer Experience (DX) and eliminate the need for repetitive `as` assertions, `TComponent` offers two powerful approaches for typing and validating your retrieved elements.

### Approach A: Runtime Validation (Recommended for most cases)

The simplest and safest way to retrieve an element is to pass its expected class constructor as the **second argument** to `getById()`.

This approach serves two purposes:

1. **Dynamic Type Inference:** TypeScript will automatically infer the return type based on the class you pass, completely eliminating the need for `as Type` assertions.
2. **Runtime Safety:** `TComponent` performs an `instanceof` check at runtime. If the template changes and the element is no longer the correct tag, it throws a clear `TypeError` immediately, catching bugs early.

```typescript
import TComponent, { kebabKeys } from '@user/tcomponent';

class CustomAvatar extends TComponent<HTMLImageElement> {
  static template = /* HTML */ `<img class="avatar" />`;
  setSrc(url: string) {
    this.element.src = url;
  }
}

class UserProfile extends TComponent<HTMLFormElement> {
  static uses = kebabKeys({ CustomAvatar });
  static template = /* HTML */ `
    <form>
      <custom-avatar id="user-avatar"></custom-avatar>
      <input id="username-input" type="text" />
    </form>
  `;

  // 1. Pass the expected class as the second argument
  // Type is automatically inferred as HTMLInputElement!
  input = this.getById('username-input', HTMLInputElement);

  // Works perfectly with custom sub-components too!
  avatar = this.getById('user-avatar', CustomAvatar);

  constructor() {
    super();
    // Fully typed, no 'as' casting required.
    this.input.value = 'JohnDoe';
    this.avatar.setSrc('/path/to/image.png');
  }
}
```

### Approach B: Strict ID Generics (Recommended for large components)

If you have a massive component with dozens of IDs, passing the class every time might feel repetitive. Moreover, you might want your editor to **auto-complete the ID strings** to prevent typos.

`TComponent` supports a second generic type parameter (`IDMap`) that allows you to define the exact shape of all IDs inside your template.

```typescript
// 1. Define an interface mapping your exact IDs to their expected types
interface ProfileIdMap {
  'profile-title': HTMLHeadingElement;
  'username-input': HTMLInputElement;
  'user-avatar': CustomAvatar;
}

// 2. Pass the interface as the second generic parameter
class UserProfile extends TComponent<HTMLFormElement, ProfileIdMap> {
  // ... static template defined here ...

  constructor() {
    super();

    // Your IDE will auto-complete 'username-input' and know it's an HTMLInputElement!
    const input = this.getById('username-input');
    input.value = 'JohnDoe';

    const avatar = this.getById('user-avatar');
    avatar.setSrc('/path/to/image.png');
  }
}
```

**Benefits of Approach B:**

- **Zero runtime cost:** It operates purely at the TypeScript level.
- **IntelliSense:** Immediate auto-completion of all available IDs when typing `this.getById('...`
- **Refactoring safety:** If you rename an ID string in the `ProfileIdMap` interface, TypeScript will instantly flag any outdated strings used inside your component.

---

## Shadow DOM Encapsulation

As mentioned in the Core Concepts, `TComponent` renders into the Light DOM by default. However, if you need strict CSS encapsulation (e.g., for a highly reusable, isolated widget), you can explicitly opt into Shadow DOM.

Because `TComponent` embraces explicit, vanilla-like DOM manipulation, you don't need a special framework API to do this. You simply attach a Shadow Root inside your component's constructor and move the auto-generated parsed elements into it.

### Example: Creating a Shadow DOM Component

_Note: The `super()` call automatically builds the AST and appends the elements to `this.element` (the host). To encapsulate the template, we move those built nodes into the newly attached Shadow Root._

```typescript
import TComponent, { ComponentParams, applyParams } from '@haiix/tcomponent';

class EncapsulatedCard extends TComponent<HTMLElement> {
  static template = /* HTML */ `
    <article class="card">
      <style>
        /* This style is strictly scoped to this component's Shadow DOM */
        .card {
          border: 1px solid #ccc;
          padding: 16px;
          border-radius: 8px;
          background: white;
        }
        h2 {
          color: royalblue;
          margin-top: 0;
        }
      </style>

      <h2 id="card-title">Default Title</h2>
      <!-- The slot content will be injected here -->
      <div id="card-body"></div>
    </article>
  `;

  constructor(params: ComponentParams) {
    super(params);

    // 1. Explicitly attach a Shadow Root to the host element
    const shadowRoot = this.element.attachShadow({ mode: 'open' });

    // 2. Move all automatically generated child nodes from the Light DOM into the Shadow Root
    while (this.element.firstChild) {
      shadowRoot.appendChild(this.element.firstChild);
    }

    // 3. (Optional) Route props and slots to an internal element inside the Shadow DOM
    const body = this.getById('card-body', HTMLDivElement);
    applyParams(this, body, params);
  }
}
```

### Caveats with Shadow DOM

If you choose to use Shadow DOM, keep in mind standard browser behaviors:

1. **Global Styles Ignored:** Your global `styles.css` or Tailwind classes will **not** apply to the HTML inside the Shadow Root. You must include a `<style>` tag inside your `static template`.
2. **Event Retargeting:** Events bubbling out of the Shadow DOM are "retargeted". This means `event.target` will point to the host element (`EncapsulatedCard`), not the internal clicked element. `TComponent`'s automatic event binding (`onclick="..."`) inside the template still works perfectly, but external event delegation (e.g., calling `Component.from(event.target)` in a parent component) will behave differently.

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

  // Get the component instance safely via getById()
  list = this.getById('my-list', DynamicList);
  itemCount = 0;

  handleAddButton() {
    this.itemCount++;
    // A new <li> element is generated from the AST template and appended
    this.list.append(`Item #${this.itemCount}`);
  }
}
```
