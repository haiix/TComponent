import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ParseOptions, ComponentParams } from '../src/types';
import { TComponent } from '../src/TComponent';
import { resetWarnings } from '../src/internal/console';

let uuidCounter = 0;

beforeEach(() => {
  uuidCounter = 0;
  vi.stubGlobal('crypto', { randomUUID: () => `mock-uuid-${++uuidCounter}` });
  resetWarnings();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('TComponent & build', () => {
  it('builds base elements and resolves id and reference attributes (for, aria-*) with UUIDs', () => {
    class MyComponent extends TComponent<HTMLDivElement> {
      static template = /* HTML */ `
        <div>
          <label for="input-1" id="label-1">Name</label>
          <input id="input-1" aria-labelledby="label-1" type="text" />
        </div>
      `;
    }

    const controller = new AbortController();
    const comp = new MyComponent({ signal: controller.signal });

    const label = comp.idMap['label-1'] as HTMLLabelElement;
    const input = comp.idMap['input-1'] as HTMLInputElement;

    expect(label).toBe(comp.element.querySelector('label'));
    expect(input).toBe(comp.element.querySelector('input'));

    expect(input.getAttribute('type')).toBe('text');

    expect(label.id).toBe('mock-uuid-1');
    expect(input.id).toBe('mock-uuid-2');

    expect(label.getAttribute('for')).toBe('mock-uuid-2');
    expect(input.getAttribute('aria-labelledby')).toBe('mock-uuid-1');
  });

  it('resolves multiple space-separated IDs with irregular whitespaces and preserves unresolvable/custom component IDs', () => {
    class MultiIdComponent extends TComponent<HTMLDivElement> {
      static template = /* HTML */ `
        <div>
          <h1 id="title-1">Title</h1>
          <p id="desc-1">Description</p>
          <div
            aria-labelledby="  title-1    desc-1
             unknown-id  "
          >
            Content
          </div>
        </div>
      `;
    }

    const controller = new AbortController();
    const comp = new MultiIdComponent({ signal: controller.signal });

    const h1 = comp.idMap['title-1'] as HTMLHeadingElement;
    const p = comp.idMap['desc-1'] as HTMLParagraphElement;
    const div = comp.element.querySelector('div')!;

    expect(h1.id).toBe('mock-uuid-1');
    expect(p.id).toBe('mock-uuid-2');

    expect(div.getAttribute('aria-labelledby')).toBe(
      'mock-uuid-1 mock-uuid-2 unknown-id',
    );
  });
});

describe('parseOptions inside TComponent', () => {
  it('applies parseOptions.preserveWhitespace regardless of explicit configuration, and implicitly inherits to subclasses', () => {
    class PreservedComp extends TComponent<HTMLDivElement> {
      static parseOptions: ParseOptions = { preserveWhitespace: true };
      static template = /* HTML */ `
        <div>
          <span>A</span>
          <span>B</span>
        </div>
      `;
    }

    class DefaultComp extends PreservedComp {
      static template = /* HTML */ `
        <div>
          <span>A</span>
          <span>B</span>
        </div>
      `;
    }

    const preservedInstance = new PreservedComp();
    const defaultInstance = new DefaultComp();

    const preservedChildNodes = Array.from(
      preservedInstance.element.childNodes,
    );
    expect(preservedChildNodes).toHaveLength(5);
    expect(preservedChildNodes[0]!.nodeType).toBe(Node.TEXT_NODE);

    const defaultChildNodes = Array.from(defaultInstance.element.childNodes);
    expect(defaultChildNodes).toHaveLength(5);
    expect(defaultChildNodes[0]!.nodeType).toBe(Node.TEXT_NODE);
  });
});

describe('Event Binding & Error Handling', () => {
  class EventComponent extends TComponent<HTMLButtonElement> {
    static template = `<button onclick="handleClick">Click Me</button>`;
    public clickCount = 0;

    handleClick() {
      this.clickCount++;
    }
  }

  it('triggers click event and calls the method', () => {
    const controller = new AbortController();
    const comp = new EventComponent({ signal: controller.signal });

    comp.element.click();
    expect(comp.clickCount).toBe(1);
  });

  it('automatically cleans up events when AbortSignal is aborted', () => {
    const controller = new AbortController();
    const comp = new EventComponent({ signal: controller.signal });

    controller.abort();
    comp.element.click();
    expect(comp.clickCount).toBe(0);
  });

  it('warns if the event handler method is not found on the component', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    class BadEventComponent extends TComponent<HTMLButtonElement> {
      static template = `<button onclick="nonExistent">Error</button>`;
    }

    const controller = new AbortController();
    new BadEventComponent({ signal: controller.signal });

    expect(warnSpy).toHaveBeenCalledWith(
      '[TComponent] Method "nonExistent" not found on component for event "onclick"',
    );
  });

  it('throws the error if onerror is called without a parent component', () => {
    const controller = new AbortController();
    const comp = new EventComponent({ signal: controller.signal });

    expect(() => {
      comp.onerror(new Error('Fatal Error'));
    }).toThrow('Fatal Error');
  });
});

describe('Event Handler Syntax & Security Validation', () => {
  it('throws SecurityError for invalid event handler syntaxes', () => {
    class XssComponent extends TComponent<HTMLButtonElement> {
      static template = `<button onclick="alert('XSS')">Invalid</button>`;
    }
    expect(() => new XssComponent()).toThrow(
      /SecurityError: Invalid event handler signature/,
    );

    class ConsoleComponent extends TComponent<HTMLButtonElement> {
      static template = `<button onclick="console.log(event)">Invalid</button>`;
    }
    expect(() => new ConsoleComponent()).toThrow(
      /SecurityError: Invalid event handler signature/,
    );

    class BadIdentifierComponent extends TComponent<HTMLButtonElement> {
      static template = `<button onclick="123invalid">Invalid</button>`;
    }
    expect(() => new BadIdentifierComponent()).toThrow(
      /SecurityError: Invalid event handler signature/,
    );
  });

  it('throws SecurityError for forbidden method names', () => {
    class ConstructorComponent extends TComponent<HTMLButtonElement> {
      static template = `<button onclick="constructor">Forbidden</button>`;
    }
    expect(() => new ConstructorComponent()).toThrow(
      /SecurityError: Access to "constructor" is forbidden/,
    );

    class ProtoComponent extends TComponent<HTMLButtonElement> {
      static template = `<button onclick="this.__proto__">Forbidden</button>`;
    }
    expect(() => new ProtoComponent()).toThrow(
      /SecurityError: Access to "__proto__" is forbidden/,
    );
  });

  it('calls event.preventDefault() when the handler returns exactly false', () => {
    class PreventDefaultComponent extends TComponent<HTMLDivElement> {
      static template = /* HTML */ `
        <div>
          <a href="#" id="link-prevent" onclick="return handlePrevent()"
            >Prevent</a
          >
          <a href="#" id="link-allow" onclick="handleAllow">Allow</a>
        </div>
      `;

      handlePrevent() {
        return false;
      }

      handleAllow() {
        // Returns a value other than false (such as undefined)
      }
    }

    const comp = new PreventDefaultComponent();
    const linkPrevent = comp.idMap['link-prevent'] as HTMLAnchorElement;
    const linkAllow = comp.idMap['link-allow'] as HTMLAnchorElement;

    const eventPrevent = new MouseEvent('click', {
      cancelable: true,
      bubbles: true,
    });
    linkPrevent.dispatchEvent(eventPrevent);
    expect(eventPrevent.defaultPrevented).toBe(true);

    const eventAllow = new MouseEvent('click', {
      cancelable: true,
      bubbles: true,
    });
    linkAllow.dispatchEvent(eventAllow);
    expect(eventAllow.defaultPrevented).toBe(false);
  });
});

describe('Lifecycle & Teardown (destroy / AbortSignal)', () => {
  class LifecycleComp extends TComponent<HTMLButtonElement> {
    static template = `<button onclick="handleClick">Click Me</button>`;
    public clickCount = 0;

    handleClick() {
      this.clickCount++;
    }
  }

  it('removes the element from the DOM and unbinds events when destroy() is called', () => {
    const comp = new LifecycleComp();
    document.body.appendChild(comp.element);

    // Initial state: events work
    comp.element.click();
    expect(comp.clickCount).toBe(1);

    // Call destroy explicitly
    comp.destroy();

    // 1. Should be removed from DOM
    expect(comp.element.isConnected).toBe(false);

    // 2. Events should be unbound (click should not increment counter)
    comp.element.click();
    expect(comp.clickCount).toBe(1);
  });

  it('destroys the component when an external parent AbortSignal is aborted', () => {
    const parentController = new AbortController();
    const comp = new LifecycleComp({ signal: parentController.signal });

    // Triggering the external abort should effectively destroy the component
    parentController.abort();

    // Events should be unbound
    comp.element.click();
    expect(comp.clickCount).toBe(0);
  });

  it('cascades destroy() automatically from parent to child components', () => {
    class Child extends TComponent<HTMLButtonElement> {
      static template = `<button onclick="handleClick">Child</button>`;
      public clickCount = 0;
      handleClick() {
        this.clickCount++;
      }
    }

    class Parent extends TComponent<HTMLDivElement> {
      static uses = { Child };
      static template = `<div><child id="my-child"></child></div>`;
    }

    const parent = new Parent();
    const child = parent.idMap['my-child'] as Child;

    // Destroying the parent should cascade to the child
    parent.destroy();

    // The child's events should be properly unbound
    child.element.click();
    expect(child.clickCount).toBe(0);
  });
});

describe('Component Composition (uses) & Props/Slots', () => {
  class ChildComponent extends TComponent<HTMLDivElement> {
    static template = `<div class="child"></div>`;

    constructor(params: ComponentParams) {
      super(params);
      if (params.attributes?.['data-text']) {
        this.element.textContent = params.attributes['data-text'];
      }
      if (params.childNodes) {
        for (const child of params.childNodes) {
          if (typeof child === 'string') {
            this.element.appendChild(document.createTextNode(child));
          }
        }
      }
    }
  }

  class ParentComponent extends TComponent<HTMLDivElement> {
    static uses = { Child: ChildComponent };
    static template = /* HTML */ `
      <div class="parent">
        <child data-text="Props Data" id="my-child">Slot Text</child>
      </div>
    `;
  }

  it('expands child components, passes Props and Slots, and maps child instances in idMap', () => {
    const controller = new AbortController();
    const parent = new ParentComponent({ signal: controller.signal });

    const child = parent.idMap['my-child'] as ChildComponent;
    expect(child).toBeInstanceOf(ChildComponent);
    expect(child.element).toBe(parent.element.querySelector('.child'));
    expect(child.element.textContent).toBe('Props DataSlot Text');
  });

  it('propagates child component errors to the parent component (Error Boundary)', () => {
    const controller = new AbortController();

    class ErrorChild extends TComponent<HTMLDivElement> {
      static template = `<div onclick="fail"></div>`;
      fail() {
        throw new Error('Child Failed');
      }
    }

    class ErrorParent extends TComponent<HTMLDivElement> {
      static uses = { errorchild: ErrorChild };
      static template = `<div><errorchild id="my-child"></errorchild></div>`;
    }

    const parent = new ErrorParent({ signal: controller.signal });
    const parentOnErrorSpy = vi
      .spyOn(parent, 'onerror')
      .mockImplementation(() => {});

    const child = parent.idMap['my-child'] as ErrorChild;
    child.element.click();

    expect(parentOnErrorSpy).toHaveBeenCalledTimes(1);
    expect(parentOnErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Child Failed' }),
    );
  });

  it('caches lowercased uses and correctly maps camelCase component tags', () => {
    class MockChild extends TComponent<HTMLDivElement> {
      static template = `<div class="mock-child"></div>`;
    }

    class CachedParent extends TComponent<HTMLDivElement> {
      static uses = { MyCustomChild: MockChild };
      static template = /* HTML */ `
        <div>
          <mycustomchild id="child-1"></mycustomchild>
        </div>
      `;
    }

    const controller = new AbortController();
    const parent1 = new CachedParent({ signal: controller.signal });
    const parent2 = new CachedParent({ signal: controller.signal });

    expect(parent1.idMap['child-1']).toBeInstanceOf(MockChild);
    expect(parent2.idMap['child-1']).toBeInstanceOf(MockChild);

    const parsedUses = CachedParent.getParsed().uses;
    expect(parsedUses).toHaveProperty('mycustomchild');
  });
});

describe('TComponent.from', () => {
  class ListItem extends TComponent<HTMLLIElement> {
    static template = /* HTML */ `<li class="list-item">Item</li>`;
    public isSelected = false;

    select() {
      this.isSelected = true;
    }
  }

  class AnotherComponent extends TComponent<HTMLDivElement> {
    static template = /* HTML */ `<div>Another</div>`;
  }

  it('retrieves the component instance from its root element', () => {
    const item = new ListItem();

    // Explicitly retrieve the instance from the element
    const retrieved = ListItem.from(item.element);

    expect(retrieved).toBe(item);
    expect(retrieved).toBeInstanceOf(ListItem);
  });

  it('returns undefined for null, undefined, or unassociated elements', () => {
    const unassociatedElement = document.createElement('li');

    expect(ListItem.from(null)).toBeUndefined();
    expect(ListItem.from(undefined)).toBeUndefined();
    expect(ListItem.from(unassociatedElement)).toBeUndefined();
  });

  it('returns undefined if the element belongs to a different component class', () => {
    const another = new AnotherComponent();

    // The element exists in the registry, but it's NOT a ListItem.
    // It should safely return undefined instead of casting incorrectly.
    const retrieved = ListItem.from(another.element);

    expect(retrieved).toBeUndefined();
  });

  it('supports retrieving instances of subclasses', () => {
    class SpecializedItem extends ListItem {
      static template = /* HTML */ `<li class="special">Special</li>`;
    }

    const specialItem = new SpecializedItem();

    // Since SpecializedItem extends ListItem, fetching via the base class should work.
    const retrieved = ListItem.from(specialItem.element);

    expect(retrieved).toBe(specialItem);
    expect(retrieved).toBeInstanceOf(SpecializedItem);
  });

  it('can be used effectively for event delegation and array mapping', () => {
    class ListApp extends TComponent<HTMLUListElement> {
      static uses = { ListItem };
      static template = /* HTML */ `
        <ul onclick="handleListClick">
          <listitem></listitem>
          <listitem></listitem>
        </ul>
      `;

      public lastClickedItem?: ListItem;

      handleListClick(event: MouseEvent) {
        const target = event.target as Element;
        const liElement = target.closest('li');

        // Retrieve the child component instance using the DOM element
        const item = ListItem.from(liElement);
        if (item) {
          item.select();
          this.lastClickedItem = item;
        }
      }
    }

    const app = new ListApp();
    const firstLi = app.element.querySelector('li')!;

    // 1. Array mapping scenario
    const allItems = Array.from(app.element.children).map((el) =>
      ListItem.from(el),
    );
    expect(allItems.length).toBe(2);
    expect(allItems[0]).toBeInstanceOf(ListItem);
    expect(allItems[1]).toBeInstanceOf(ListItem);

    // 2. Event delegation scenario
    firstLi.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(app.lastClickedItem).toBe(allItems[0]);
    expect(allItems[0]!.isSelected).toBe(true);
    expect(allItems[1]!.isSelected).toBe(false); // Second item remains unaffected
  });
});
