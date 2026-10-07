import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ParseOptions, ComponentParams } from '../src/types';
import { TComponent } from '../src/TComponent';
import { BuildContext } from '../src/BuildContext';
import { applyParams } from '../src/utils/applyParams';
import { resetWarnings } from '../src/internal/messages';

beforeEach(() => {
  resetWarnings();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('TComponent - Construction Failure Cleanup', () => {
  it.each(['external', 'parent'] as const)(
    'removes links to the %s signal and already bound events after repeated failures',
    (owner) => {
      const controller = new AbortController();
      const parent = new TComponent();
      const signal = owner === 'external' ? controller.signal : parent.signal;
      const params = owner === 'external' ? { signal } : { parent };
      const add = vi.spyOn(signal, 'addEventListener');
      const remove = vi.spyOn(signal, 'removeEventListener');
      const click = vi.fn();
      const destroy = vi.fn();
      const failed: TComponent[] = [];
      // eslint-disable-next-line @typescript-eslint/unbound-method -- The original method is called with its context via apply below.
      const build = BuildContext.prototype.build;
      vi.spyOn(BuildContext.prototype, 'build').mockImplementation(function (
        this: BuildContext,
        ...args
      ) {
        if (!failed.includes(this.component as TComponent)) {
          failed.push(this.component as TComponent);
        }
        return build.apply(this, args);
      });

      class Broken extends TComponent {
        static template =
          '<div><button id="ok" onclick="handleClick">OK</button><button onclick="bad() + 1">Bad</button></div>';
        handleClick() {
          click();
        }
        override destroy() {
          destroy();
        }
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        expect(() => new Broken(params)).toThrow(
          'SecurityError: Invalid event handler signature',
        );
      }

      expect(failed).toHaveLength(3);
      expect(add).toHaveBeenCalledTimes(3);
      expect(remove).toHaveBeenCalledTimes(3);
      for (const [index, call] of add.mock.calls.entries()) {
        expect(remove.mock.calls[index]).toEqual(['abort', call[1]]);
      }
      for (const component of failed) {
        expect(component.element).toBeUndefined();
        expect(component.signal.aborted).toBe(true);
        component.getById('ok', HTMLButtonElement).click();
      }
      expect(click).not.toHaveBeenCalled();
      expect(destroy).not.toHaveBeenCalled();
      expect(signal.aborted).toBe(false);
      expect(parent.signal.aborted).toBe(false);
      parent.destroy();
    },
  );

  it('aborts built descendants, including children whose signals are still lazy', () => {
    const descendants: TComponent[] = [];
    const click = vi.fn();
    class Leaf extends TComponent<HTMLButtonElement> {
      static template = '<button onclick="handleClick">Leaf</button>';
      constructor(params: ComponentParams) {
        super(params);
        descendants.push(this);
      }
      handleClick() {
        click();
      }
    }
    class Child extends TComponent {
      static uses = { Leaf };
      static template = '<div><Leaf></Leaf></div>';
      constructor(params: ComponentParams) {
        super(params);
        descendants.push(this);
      }
    }
    class LazyChild extends TComponent {
      constructor(params: ComponentParams) {
        super(params);
        descendants.push(this);
      }
    }
    class Broken extends TComponent {
      static uses = { Child, LazyChild };
      static template =
        '<div><Child></Child><LazyChild></LazyChild><button onclick="bad() + 1">Bad</button></div>';
    }
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, 'addEventListener');
    const remove = vi.spyOn(controller.signal, 'removeEventListener');

    expect(() => new Broken({ signal: controller.signal })).toThrow(
      'SecurityError: Invalid event handler signature',
    );

    expect(descendants).toHaveLength(3);
    for (const component of descendants) {
      expect(component.signal.aborted).toBe(true);
    }
    (descendants[0] as Leaf).element.click();
    expect(click).not.toHaveBeenCalled();
    expect(add).toHaveBeenCalledExactlyOnceWith('abort', expect.any(Function), {
      once: true,
    });
    expect(remove).toHaveBeenCalledExactlyOnceWith(
      'abort',
      add.mock.calls[0]![1],
    );
    expect(controller.signal.aborted).toBe(false);
  });

  it('preserves the original ID resolution error and does not register the failed instance', () => {
    const error = new Error('ID resolution failed');
    const click = vi.fn();
    let failed: TComponent | undefined;
    vi.spyOn(BuildContext.prototype, 'resolveIdReferences').mockImplementation(
      function (this: BuildContext) {
        failed = this.component as TComponent;
        throw error;
      },
    );
    class Broken extends TComponent<HTMLButtonElement> {
      static template = '<button onclick="handleClick">OK</button>';
      handleClick() {
        click();
      }
    }
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');

    let caught: unknown;
    try {
      new Broken({ signal: controller.signal });
    } catch (failure) {
      caught = failure;
    }
    expect(caught).toBe(error);

    expect(failed).toBeDefined();
    expect(failed!.signal.aborted).toBe(true);
    expect(TComponent.from(failed!.element)).toBeUndefined();
    (failed!.element as HTMLButtonElement).click();
    expect(click).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(controller.signal.aborted).toBe(false);
  });

  it('does not create an external link when construction fails before a signal is needed', () => {
    const error = new Error('DOM build failed');
    let failed: TComponent | undefined;
    vi.spyOn(BuildContext.prototype, 'build').mockImplementation(function (
      this: BuildContext,
    ) {
      failed = this.component as TComponent;
      throw error;
    });
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, 'addEventListener');

    expect(() => new TComponent({ signal: controller.signal })).toThrow(error);

    expect(failed).toBeDefined();
    expect(failed!.signal.aborted).toBe(true);
    expect(failed!.signal).toBe(failed!.signal);
    expect(add).not.toHaveBeenCalled();
  });
});

describe('TComponent - Native Templates', () => {
  it.each(['div', 'template'])(
    'preserves and clones native template contents with a %s root',
    (rootTag) => {
      class Example extends TComponent {
        static template = `<${rootTag}><template id="row">Before<span class="row">Row</span><template id="nested"><b>Nested</b></template>After</template></${rootTag}>`;
      }

      const first = new Example();
      const second = new Example();
      const row = first.getById('row', HTMLTemplateElement);
      const nested = first.getById('nested', HTMLTemplateElement);
      expect(row.childNodes).toHaveLength(0);
      expect(row.content.childNodes).toHaveLength(4);
      expect(row.content.querySelector('span')?.outerHTML).toBe(
        '<span class="row">Row</span>',
      );
      expect(row.content.querySelector('template')).toBe(nested);
      expect(nested.childNodes).toHaveLength(0);
      expect(nested.content.firstElementChild?.outerHTML).toBe('<b>Nested</b>');

      const clone = row.content.cloneNode(true) as DocumentFragment;
      expect(clone.childNodes).toHaveLength(4);
      expect(
        clone.querySelector('template')?.content.firstElementChild?.outerHTML,
      ).toBe('<b>Nested</b>');
      const clonedSpan = clone.querySelector('span')!;
      expect(clonedSpan).not.toBe(row.content.querySelector('span'));
      const target = document.createElement('div');
      target.appendChild(clone);
      expect(target.textContent).toBe('BeforeRowAfter');
      clonedSpan.textContent = 'Changed';
      expect(row.content.querySelector('span')?.textContent).toBe('Row');
      expect(
        second.getById('row', HTMLTemplateElement).content.querySelector('span')
          ?.textContent,
      ).toBe('Row');
    },
  );
});

describe('TComponent - Declarative Button Targets', () => {
  describe.each(['popovertarget', 'commandfor'])('%s', (attribute) => {
    it.each(['before', 'after'] as const)(
      'resolves a target placed %s the button with separate IDs per instance',
      (position) => {
        const targetTemplate =
          attribute === 'popovertarget'
            ? '<div id="target" popover>Menu</div>'
            : '<dialog id="target">Dialog</dialog>';
        const buttonTemplate = `<button id="button" type="button" ${attribute}="target" ${
          attribute === 'popovertarget'
            ? 'popovertargetaction="show"'
            : 'command="show-modal"'
        }>Open</button>`;
        class Example extends TComponent {
          static template = `<div>${
            position === 'before'
              ? targetTemplate + buttonTemplate
              : buttonTemplate + targetTemplate
          }</div>`;
        }

        const first = new Example();
        const second = new Example();
        document.body.append(first.element, second.element);
        try {
          for (const component of [first, second]) {
            const target = component.getById('target', HTMLElement);
            const button = component.getById('button', HTMLButtonElement);
            expect(target.id).not.toBe('');
            expect(target.id).not.toBe('target');
            expect(button.getAttribute(attribute)).toBe(target.id);
            expect(document.getElementById(target.id)).toBe(target);
            expect(
              button.getAttribute(
                attribute === 'popovertarget'
                  ? 'popovertargetaction'
                  : 'command',
              ),
            ).toBe(attribute === 'popovertarget' ? 'show' : 'show-modal');
            expect(component.context.idReferenceMap).toHaveLength(0);
          }
          expect(first.getById('target', HTMLElement).id).not.toBe(
            second.getById('target', HTMLElement).id,
          );
        } finally {
          first.element.remove();
          second.element.remove();
        }
      },
    );
  });
});

describe('TComponent - External Form Controls', () => {
  it.each(['before', 'after'] as const)(
    'associates external controls when the form is %s them',
    (position) => {
      const formTemplate = '<form id="f"></form>';
      const controlsTemplate =
        '<input id="i" name="q" value="query" form="f"><button id="save" type="submit" form="f">Save</button>';
      class Example extends TComponent {
        static template = `<div>${
          position === 'before'
            ? formTemplate + controlsTemplate
            : controlsTemplate + formTemplate
        }</div>`;
      }

      const first = new Example();
      const second = new Example();
      document.body.append(first.element, second.element);
      try {
        for (const component of [first, second]) {
          const form = component.getById('f', HTMLFormElement);
          const input = component.getById('i', HTMLInputElement);
          const button = component.getById('save', HTMLButtonElement);
          expect(form.id).toMatch(/^uid-|^[0-9a-f-]{36}$/);
          expect(input.getAttribute('form')).toBe(form.id);
          expect(button.getAttribute('form')).toBe(form.id);
          expect(input.form).toBe(form);
          expect(button.form).toBe(form);
          expect(Array.from(form.elements)).toEqual([input, button]);
          expect(new FormData(form).get('q')).toBe('query');

          const submit = vi.fn((event: Event) => {
            event.preventDefault();
          });
          form.addEventListener('submit', submit);
          button.click();
          expect(submit).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ submitter: button }),
          );
        }
        expect(first.getById('f', HTMLFormElement).id).not.toBe(
          second.getById('f', HTMLFormElement).id,
        );
      } finally {
        first.element.remove();
        second.element.remove();
      }
    },
  );
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
  it('does not register listeners with a signal first accessed after destroy', () => {
    // Use a browser realm: Vitest's Node signal adapter misses prior aborts.
    const frame = document.createElement('iframe');
    document.body.append(frame);
    try {
      const browserWindow = frame.contentWindow as Window & typeof globalThis;
      vi.stubGlobal('AbortController', browserWindow.AbortController);
      const component = new TComponent();
      component.destroy();

      const button = browserWindow.document.createElement('button');
      const handler = vi.fn();
      button.addEventListener('click', handler, { signal: component.signal });
      button.click();

      expect(component.signal.aborted).toBe(true);
      expect(handler).not.toHaveBeenCalled();
    } finally {
      frame.remove();
    }
  });

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
    expect(
      // Intentionally demonstrate that optional chaining cannot suppress a lookup error.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      () => comp.getById('non-existent', HTMLElement)?.textContent,
    ).toThrow(/not found/);
  });

  it('retains registered children and slot elements after the receiver is destroyed', () => {
    class SubComp extends TComponent {
      static template = '<section></section>';

      constructor(params: ComponentParams = {}) {
        super(params);
        applyParams(this, this.element, params);
      }
    }

    class App extends TComponent {
      static uses = { 'sub-comp': SubComp };
      static template = `
        <div>
          <sub-comp id="subComp">
            <span id="slot">Slot Text</span>
          </sub-comp>
        </div>
      `;
    }

    const app = new App();
    document.body.append(app.element);
    try {
      const child = app.getById('subComp', SubComp);
      const slot = app.getById('slot', HTMLElement);
      expect(slot.isConnected).toBe(true);
      expect(() => child.getById('slot')).toThrow(/not found/);

      child.destroy();

      expect(child.signal.aborted).toBe(true);
      expect(child.element.isConnected).toBe(false);
      expect(slot.isConnected).toBe(false);
      expect(app.getById('subComp')).toBe(child);
      expect(app.getById('subComp', SubComp)).toBe(child);
      expect(app.getById('slot')).toBe(slot);
      expect(app.getById('slot', HTMLElement).textContent).toBe('Slot Text');

      app.destroy();

      expect(app.getById('subComp', SubComp)).toBe(child);
      expect(app.getById('slot', HTMLElement)).toBe(slot);
    } finally {
      app.destroy();
    }
  });

  it('retains a registered native element after it is removed from the DOM', () => {
    const comp = new TestComp();
    const title = comp.getById('title', HTMLHeadingElement);
    title.remove();

    expect(comp.element.contains(title)).toBe(false);
    expect(comp.getById('title')).toBe(title);
    expect(comp.getById('title', HTMLHeadingElement)).toBe(title);
    comp.destroy();
  });

  it('does not register a manually created child in its parent ID map', () => {
    const parent = new TComponent();
    const child = new TestComp({ parent });
    parent.element.append(child.element);

    expect(child.parent).toBe(parent);
    expect(TComponent.from(parent.element.firstElementChild)).toBe(child);
    expect(Object.keys(parent.context.idMap)).toEqual([]);
    expect(child.getById('title')).toBeInstanceOf(HTMLHeadingElement);

    child.destroy();
    expect(Object.keys(parent.context.idMap)).toEqual([]);
    parent.destroy();
  });

  it.each(['toString', 'constructor', '__proto__'])(
    'retrieves an element registered with ID "%s" without a duplicate warning',
    (id) => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      class SpecialIdComp extends TComponent {
        static template = `<div><span id="${id}"></span></div>`;
      }

      const comp = new SpecialIdComp();
      const span = comp.element.firstElementChild;

      expect(comp.getById(id)).toBe(span);
      expect(comp.getById(id, HTMLSpanElement)).toBe(span);
      expect(warnSpy).not.toHaveBeenCalled();
    },
  );

  it.each(['toString', 'constructor', '__proto__'])(
    'throws a not found error for unregistered ID "%s"',
    (id) => {
      const comp = new TestComp();

      expect(() => comp.getById(id)).toThrow(
        `Element with id "${id}" not found.`,
      );
      expect(() => comp.getById(id, Element)).toThrow(
        `Element with id "${id}" not found.`,
      );
    },
  );

  it.each(['toString', 'constructor', '__proto__'])(
    'retrieves a sub-component registered with ID "%s"',
    (id) => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      class SpecialIdParent extends TComponent {
        static uses = { ChildComp };
        static template = `<div><childcomp id="${id}"></childcomp></div>`;
      }

      const parent = new SpecialIdParent();
      const child = parent.getById(id, ChildComp);

      expect(parent.getById(id)).toBe(child);
      expect(child.element).toBe(parent.element.firstElementChild);
      expect(warnSpy).not.toHaveBeenCalled();
    },
  );

  it.each(['toString', 'constructor', '__proto__'])(
    'keeps the first element when ID "%s" is duplicated',
    (id) => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      class DuplicateIdComp extends TComponent {
        static template = `<div><span id="${id}">First</span><span id="${id}">Second</span></div>`;
      }

      const comp = new DuplicateIdComp();

      expect(comp.getById(id)).toBe(comp.element.firstElementChild);
      expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
        `[TComponent] Duplicate id "${id}" found in template. Only the first instance will be mapped.`,
      );
    },
  );

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

  it('builds an unregistered constructor child as a native DOM element', () => {
    class Parent extends TComponent {
      static template =
        '<div><constructor id="child">Content</constructor></div>';
    }

    const parent = new Parent();
    const child = parent.getById('child', HTMLElement);
    expect(parent.element.firstElementChild).toBe(child);
    expect(child.localName).toBe('constructor');
    expect(child.textContent).toBe('Content');
  });

  it('instantiates an explicitly registered constructor child component', () => {
    class Parent extends TComponent {
      static uses = { constructor: ChildComponent };
      static template = '<div><constructor id="child"></constructor></div>';
    }

    const parent = new Parent();
    const child = parent.getById('child', ChildComponent);
    expect(parent.element.firstElementChild).toBe(child.element);
    expect(child.parent).toBe(parent);
  });

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
  it('builds an unregistered constructor root as a native DOM element', () => {
    class NativeRoot extends TComponent {
      static template = '<constructor class="native">Content</constructor>';
    }

    const component = new NativeRoot();
    expect(component.element).toBeInstanceOf(HTMLElement);
    expect(component.element.localName).toBe('constructor');
    expect(component.element.className).toBe('native');
    expect(component.element.textContent).toBe('Content');
  });

  it('rejects an explicitly registered constructor root component', () => {
    class InvalidRoot extends TComponent {
      static uses = { constructor: TComponent };
      static template = '<constructor></constructor>';
    }

    expect(() => new InvalidRoot()).toThrow(
      /The root element of a template cannot be a custom component/,
    );
  });

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
  it('rebuilds canonical SVG tags and preserves the foreignObject HTML boundary', () => {
    class Graphic extends TComponent<SVGSVGElement> {
      static template = `<svg>
        <defs>
          <linearGradient id="paint"><stop offset="0" /></linearGradient>
          <radialGradient id="radial"></radialGradient>
          <clipPath id="clip"><rect /></clipPath>
          <filter><feGaussianBlur id="blur" /></filter>
        </defs>
        <foreignObject id="content"><DIV id="html">Hello<svg><linearGradient id="nested" /></svg></DIV></foreignObject>
      </svg>`;
    }

    const graphic = new Graphic();
    expect(graphic.element).toBeInstanceOf(SVGSVGElement);
    const native = document.createElement('template');
    native.innerHTML = Graphic.template;
    for (const [id, tag] of [
      ['paint', 'linearGradient'],
      ['radial', 'radialGradient'],
      ['clip', 'clipPath'],
      ['blur', 'feGaussianBlur'],
      ['content', 'foreignObject'],
      ['nested', 'linearGradient'],
    ] as const) {
      const element = graphic.getById(id, SVGElement);
      const parsedElement = native.content.querySelector(`[id="${id}"]`);
      expect(element.localName).toBe(tag);
      expect(element.namespaceURI).toBe('http://www.w3.org/2000/svg');
      expect(element.constructor).toBe(parsedElement?.constructor);
    }
    const html = graphic.getById('html', HTMLDivElement);
    expect(html.localName).toBe('div');
    expect(html.namespaceURI).toBe('http://www.w3.org/1999/xhtml');
    expect(html.parentElement).toBe(graphic.getById('content', SVGElement));
  });

  it('matches canonical SVG tags against lowercased uses keys', () => {
    class Gradient extends TComponent<SVGSVGElement> {
      static template = '<svg class="replacement"></svg>';
    }
    class Graphic extends TComponent<SVGSVGElement> {
      static uses = { LinearGradient: Gradient };
      static template =
        '<svg><linearGradient id="paint"></linearGradient></svg>';
    }

    const graphic = new Graphic();
    const gradient = graphic.getById('paint', Gradient);
    expect(graphic.element.firstElementChild).toBe(gradient.element);
    expect(gradient.element.classList.contains('replacement')).toBe(true);
    expect(Graphic.getParsed().uses).toHaveProperty('lineargradient', Gradient);
  });

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
  it('recovers a component with a strict IDMap after forwarding parameters', () => {
    interface IDs {
      input: HTMLInputElement;
    }
    class Typed extends TComponent<HTMLDivElement, IDs> {
      static template = '<div><input id="input"></div>';
    }

    const component = new Typed();
    applyParams(component, component.element);
    applyParams(component, component.getById('input'), {
      attributes: { class: 'forwarded', value: 'typed input' },
    });

    const recovered = Typed.from(component.element);
    expect(recovered).toBe(component);
    expect(recovered?.getById('input').value).toBe('typed input');
    expect(recovered?.getById('input').className).toBe('forwarded');
    expect(Typed.from(new TComponent().element)).toBeUndefined();
  });

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
