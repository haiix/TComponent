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

describe('TComponent - parseOptions Configuration', () => {
  it('applies parseOptions.preserveWhitespace implicitly and inherits to subclasses', () => {
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

    // With preserveWhitespace: true, the newlines between spans are kept as text nodes
    const preservedChildNodes = Array.from(
      preservedInstance.element.childNodes,
    );
    expect(preservedChildNodes).toHaveLength(5);
    expect(preservedChildNodes[0]!.nodeType).toBe(Node.TEXT_NODE);

    // Subclasses should inherit the static configuration
    const defaultChildNodes = Array.from(defaultInstance.element.childNodes);
    expect(defaultChildNodes).toHaveLength(5);
    expect(defaultChildNodes[0]!.nodeType).toBe(Node.TEXT_NODE);
  });
});

describe('TComponent - Lifecycle & Teardown (.destroy)', () => {
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

    comp.element.click();
    expect(comp.clickCount).toBe(1);

    comp.destroy();

    // 1. Removed from DOM
    expect(comp.element.isConnected).toBe(false);

    // 2. Events unbound (click count shouldn't increase)
    comp.element.click();
    expect(comp.clickCount).toBe(1);
  });

  it('cascades destroy() automatically from Parent to Child components', () => {
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

    // Destroying the parent should cascade down to the child
    parent.destroy();

    child.element.click();
    expect(child.clickCount).toBe(0);
  });
});

describe('TComponent - Composition (uses) & Error Boundaries', () => {
  class ChildComponent extends TComponent<HTMLDivElement> {
    static template = `<div class="child"></div>`;

    constructor(params: ComponentParams) {
      super(params);
      if (params.attributes?.['data-text']) {
        this.element.textContent = params.attributes['data-text'];
      }
      // Manually append slots for testing
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
    const parent = new ParentComponent();
    const child = parent.idMap['my-child'] as ChildComponent;

    expect(child).toBeInstanceOf(ChildComponent);
    expect(child.element).toBe(parent.element.querySelector('.child'));
    expect(child.element.textContent).toBe('Props DataSlot Text');
  });

  it('propagates child component errors to the parent component (Error Boundary)', () => {
    class ErrorChild extends TComponent<HTMLDivElement> {
      static template = `<div onclick="fail"></div>`;
      fail() {
        throw new Error('Child Failed');
      }
    }

    class ErrorParent extends TComponent<HTMLDivElement> {
      static uses = { ErrorChild };
      static template = `<div><errorchild id="my-child"></errorchild></div>`;
    }

    const parent = new ErrorParent();
    const parentOnErrorSpy = vi
      .spyOn(parent, 'onerror')
      .mockImplementation(() => {});
    const child = parent.idMap['my-child'] as ErrorChild;

    // Trigger the error in the child
    child.element.click();

    // The parent's onerror should catch it
    expect(parentOnErrorSpy).toHaveBeenCalledTimes(1);
    expect(parentOnErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Child Failed' }),
    );
  });

  it('throws the error if onerror is called without a parent component', () => {
    const rootComp = new ChildComponent({});

    expect(() => {
      rootComp.onerror(new Error('Fatal Error'));
    }).toThrow('Fatal Error');
  });

  it('caches lowercased uses and correctly maps camelCase component tags via getParsed()', () => {
    class MockChild extends TComponent<HTMLDivElement> {
      static template = `<div class="mock-child"></div>`;
    }

    class CachedParent extends TComponent<HTMLDivElement> {
      static uses = { MyCustomChild: MockChild };
      static template = `<div><mycustomchild id="child-1"></mycustomchild></div>`;
    }

    const parent1 = new CachedParent();
    const parent2 = new CachedParent();

    // Verify it works correctly
    expect(parent1.idMap['child-1']).toBeInstanceOf(MockChild);
    expect(parent2.idMap['child-1']).toBeInstanceOf(MockChild);

    // Verify the static cache was built
    const parsedUses = CachedParent.getParsed().uses;
    expect(parsedUses).toHaveProperty('mycustomchild');
  });
});

describe('TComponent.from (Global Registry Mapping)', () => {
  class ListItem extends TComponent<HTMLLIElement> {
    static template = `<li class="list-item">Item</li>`;
    public isSelected = false;
    select() {
      this.isSelected = true;
    }
  }

  class AnotherComponent extends TComponent<HTMLDivElement> {
    static template = `<div>Another</div>`;
  }

  it('retrieves the component instance from its root element', () => {
    const item = new ListItem();
    const retrieved = ListItem.from(item.element);
    expect(retrieved).toBe(item);
  });

  it('returns undefined for null, undefined, or unassociated elements', () => {
    const unassociatedElement = document.createElement('li');
    expect(ListItem.from(null)).toBeUndefined();
    expect(ListItem.from(undefined)).toBeUndefined();
    expect(ListItem.from(unassociatedElement)).toBeUndefined();
  });

  it('returns undefined if the element belongs to a different component class', () => {
    const another = new AnotherComponent();
    // Element exists in registry, but type doesn't match
    const retrieved = ListItem.from(another.element);
    expect(retrieved).toBeUndefined();
  });

  it('supports retrieving instances of subclasses', () => {
    class SpecializedItem extends ListItem {
      static template = `<li class="special">Special</li>`;
    }

    const specialItem = new SpecializedItem();
    // Fetching via the base class should work because it passes instanceof
    const retrieved = ListItem.from(specialItem.element);

    expect(retrieved).toBe(specialItem);
    expect(retrieved).toBeInstanceOf(SpecializedItem);
  });
});
