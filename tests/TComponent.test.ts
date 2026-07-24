import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ParseOptions, ComponentParams } from '../src/types';
import { TComponent } from '../src/TComponent';
import { applyParams } from '../src/utils/applyParams';
import { resetWarnings } from '../src/internal/console';

beforeEach(() => {
  resetWarnings();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TComponent - parseOptions Configuration', () => {
  it('applies parseOptions.preserveWhitespace implicitly and inherits to subclasses', () => {
    class PreservedComp extends TComponent<HTMLDivElement> {
      static parseOptions: ParseOptions = { preserveWhitespace: true };
      static template = `
        <div>
          <span>A</span>
          <span>B</span>
        </div>
      `;
    }

    class DefaultComp extends PreservedComp {
      static template = `
        <div>
          <span>A</span>
          <span>B</span>
        </div>
      `;
    }

    const preservedInstance = new PreservedComp();
    const defaultInstance = new DefaultComp();

    expect(preservedInstance.element.childNodes).toHaveLength(5);
    expect(preservedInstance.element.childNodes[0]!.nodeType).toBe(
      Node.TEXT_NODE,
    );

    expect(defaultInstance.element.childNodes).toHaveLength(5);
    expect(defaultInstance.element.childNodes[0]!.nodeType).toBe(
      Node.TEXT_NODE,
    );
  });
});

describe('TComponent - Template Integration (Events & Hierarchy)', () => {
  it('unbinds event listeners defined in the template when destroyed', () => {
    class EventComp extends TComponent<HTMLButtonElement> {
      static template = `<button onclick="handleClick">Click Me</button>`;

      handleClick() {}
    }

    const comp = new EventComp();
    const clickSpy = vi.spyOn(comp, 'handleClick');

    comp.element.click();
    expect(clickSpy).toHaveBeenCalledTimes(1);

    // Destroy should unbind the event
    comp.destroy();

    comp.element.click();
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('establishes parent-child relationships automatically via template composition', () => {
    class Child extends TComponent<HTMLButtonElement> {
      static template = `<button onclick="handleClick">Child</button>`;

      handleClick() {}
    }

    class Parent extends TComponent<HTMLDivElement> {
      static uses = { Child };
      static template = `<div><child id="my-child"></child></div>`;
    }

    const parent = new Parent();
    const child = parent.getById('my-child', Child);

    expect(child.parent).toBe(parent);

    const childClickSpy = vi.spyOn(child, 'handleClick');

    // Destroying the parent should cascade and unbind the child's events
    parent.destroy();

    child.element.click();

    expect(childClickSpy).not.toHaveBeenCalled();
  });
});

describe('TComponent - Dynamic Event Resolution', () => {
  it('allows event handlers to be overridden dynamically after instantiation', () => {
    class DynamicEventComp extends TComponent<HTMLButtonElement> {
      static template = `<button onclick="handleDynamicClick">Click</button>`;

      handleDynamicClick() {
        // Default implementation
      }
    }

    const comp = new DynamicEventComp();

    // Assign a new mock function to the instance property AFTER initialization
    const overrideMock = vi.fn();
    comp.handleDynamicClick = overrideMock;

    comp.element.click();

    expect(overrideMock).toHaveBeenCalledTimes(1);
  });

  it('allows easily mocking event handlers for testing using vi.spyOn', () => {
    class SpyEventComp extends TComponent<HTMLButtonElement> {
      static template = `<button onclick="handleSpyClick">Click</button>`;

      handleSpyClick() {
        // Original implementation logic
      }
    }

    const comp = new SpyEventComp();

    // Because the event listener resolves the method dynamically by name,
    // mocking it with vi.spyOn after instantiation works seamlessly.
    const spy = vi.spyOn(comp, 'handleSpyClick').mockImplementation(() => {});

    comp.element.click();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('TComponent - getById()', () => {
  class ChildComp extends TComponent<HTMLSpanElement> {
    static template = `<span class="child">Child</span>`;
  }

  class TestComp extends TComponent<HTMLDivElement> {
    static uses = { ChildComp };
    static template = `
      <div>
        <h1 id="title">Title</h1>
        <input id="my-input" type="text" />
        <childcomp id="my-child"></childcomp>
      </div>
    `;
  }

  it('retrieves an element or component by its original ID', () => {
    const comp = new TestComp();
    expect(comp.getById('title')).toBeInstanceOf(HTMLHeadingElement);
    expect(comp.getById('my-child')).toBeInstanceOf(ChildComp);
  });

  it('throws an Error if the ID does not exist in the template', () => {
    const comp = new TestComp();
    expect(() => comp.getById('non-existent')).toThrow(/not found/);
  });

  it('validates the type at runtime and returns the typed element when ExpectedType is provided', () => {
    const comp = new TestComp();
    expect(comp.getById('my-input', HTMLInputElement)).toBeInstanceOf(
      HTMLInputElement,
    );
    expect(comp.getById('my-child', ChildComp)).toBeInstanceOf(ChildComp);
  });

  it('throws a TypeError if the retrieved element does not match the ExpectedType', () => {
    const comp = new TestComp();
    expect(() => comp.getById('title', HTMLInputElement)).toThrow(
      /is not an instance of HTMLInputElement/,
    );
    expect(() => comp.getById('title', ChildComp)).toThrow(
      /is not an instance of ChildComp/,
    );
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
      if (params.childNodes) {
        for (const child of params.childNodes) {
          if (typeof child === 'string') {
            this.element.appendChild(document.createTextNode(child));
          }
        }
      }
    }
  }

  it('expands child components, passes Props and Slots, and maps child instances in idMap', () => {
    class ParentComponent extends TComponent<HTMLDivElement> {
      static uses = { Child: ChildComponent };
      static template = `
        <div class="parent">
          <child data-text="Props Data" id="my-child">Slot Text</child>
        </div>
      `;
    }

    const parent = new ParentComponent();
    const child = parent.getById('my-child', ChildComponent);

    expect(child).toBeInstanceOf(ChildComponent);
    expect(child.element.textContent).toBe('Props DataSlot Text');
  });

  it('propagates child component errors to the parent defined in the template (Error Boundary)', () => {
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
    const child = parent.getById('my-child', ErrorChild);

    child.element.click();

    expect(parentOnErrorSpy).toHaveBeenCalledTimes(1);
    expect(parentOnErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Child Failed' }),
    );
  });

  it('caches lowercased uses and correctly maps camelCase component tags via getParsed()', () => {
    class MockChild extends TComponent<HTMLDivElement> {
      static template = `<div class="mock-child"></div>`;
    }

    class CachedParent extends TComponent<HTMLDivElement> {
      static uses = { MyCustomChild: MockChild };
      static template = `<div><mycustomchild id="child-1"></mycustomchild></div>`;
    }

    const parent = new CachedParent();
    expect(parent.getById('child-1')).toBeInstanceOf(MockChild);

    const parsedUses = CachedParent.getParsed().uses;
    expect(parsedUses).toHaveProperty('mycustomchild');
  });
});

describe('TComponent - Root Element Validation', () => {
  it('throws an error if the root element of the template is a custom component', () => {
    class SubComponent extends TComponent {
      static template = `<div class="sub"></div>`;
    }

    class InvalidRootComponent extends TComponent {
      static uses = { SubComponent };
      static template = `<subcomponent></subcomponent>`;
    }

    expect(() => new InvalidRootComponent()).toThrow(
      /The root element of a template cannot be a custom component/,
    );
  });
});

describe('TComponent - Custom Namespace URI', () => {
  it('creates the root element with the specified custom namespace URI', () => {
    class PolyLineComponent extends TComponent<SVGPolylineElement> {
      static namespaceURI = 'http://www.w3.org/2000/svg';
      static template = `<polyline fill="none" stroke="black" />`;
    }

    const polyline = new PolyLineComponent();
    expect(polyline.element.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(polyline.element.tagName.toLowerCase()).toBe('polyline');
  });
});

describe('TComponent.from (Global Registry Mapping)', () => {
  class ListItem extends TComponent<HTMLLIElement> {
    static template = `<li class="list-item">Item</li>`;
  }
  class AnotherComponent extends TComponent<HTMLDivElement> {
    static template = `<div>Another</div>`;
  }

  it('retrieves the component instance from its root element', () => {
    const item = new ListItem();
    expect(ListItem.from(item.element)).toBe(item);
  });

  it('returns undefined for null, undefined, or unassociated elements', () => {
    expect(ListItem.from(null)).toBeUndefined();
    expect(ListItem.from(document.createElement('li'))).toBeUndefined();
  });

  it('returns undefined if the element belongs to a different component class', () => {
    const another = new AnotherComponent();
    expect(ListItem.from(another.element)).toBeUndefined();
  });

  it('supports retrieving instances of subclasses', () => {
    class SpecializedItem extends ListItem {
      static template = `<li class="special">Special</li>`;
    }

    const specialItem = new SpecializedItem();
    expect(ListItem.from(specialItem.element)).toBe(specialItem);
    expect(ListItem.from(specialItem.element)).toBeInstanceOf(SpecializedItem);
  });
});

describe('TComponent - Props Event Binding (applyParams Integration)', () => {
  class CustomButton extends TComponent<HTMLDivElement> {
    static template = `<div class="wrapper"><button id="btn">Child Text</button></div>`;

    constructor(params: ComponentParams) {
      super(params);
      // Route all props (including events) directly to the internal button
      applyParams(this, this.getById('btn', HTMLButtonElement), params);
    }
  }

  it('allows parent components to pass events to child components seamlessly', () => {
    class App extends TComponent<HTMLDivElement> {
      static uses = { CustomButton };
      static template = `
        <div>
          <!-- Parent passes its own method to the child's onclick prop -->
          <custombutton id="my-btn" onclick="handleParentClick" class="btn-primary"></custombutton>
        </div>
      `;

      handleParentClick = vi.fn();
    }

    const app = new App();
    const customButton = app.getById('my-btn', CustomButton);
    const internalBtn = customButton.getById('btn', HTMLButtonElement);

    // Ensure general attributes like class were routed correctly
    expect(internalBtn.className).toBe('btn-primary');

    // Clicking the internal button should trigger the Parent's method
    internalBtn.click();
    expect(app.handleParentClick).toHaveBeenCalledTimes(1);
  });
});
