import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseTemplate,
  TComponent,
  type ComponentParams,
} from '../src/TComponent';

let uuidCounter = 0;

beforeEach(() => {
  uuidCounter = 0;
  vi.stubGlobal('crypto', { randomUUID: () => `mock-uuid-${++uuidCounter}` });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('parseTemplate', () => {
  it('converts HTML string to a valid TNode tree and lowercases tags', () => {
    const html = `<DIV CLASS="container"><Span>Text</Span></DIV>`;
    const tNode = parseTemplate(html);

    expect(tNode).toEqual({
      t: 'div',
      a: { class: 'container' },
      c: [{ t: 'span', a: {}, c: ['Text'] }],
    });
  });

  it('throws an error if there is not exactly one root element', () => {
    expect(() => parseTemplate(`<div></div><span></span>`)).toThrowError(
      'ParseError: The template must have exactly one root element.',
    );
    expect(() => parseTemplate(`Text node`)).toThrowError(
      'ParseError: The template must have exactly one root element.',
    );
  });

  it('removes unnecessary newlines but keeps meaningful spaces', () => {
    const html = `
      <div>
        <span>A</span> <span>B</span>
      </div>
    `;
    const tNode = parseTemplate(html);
    expect(tNode.c[1]).toBe(' ');
  });
});

describe('TComponent & build', () => {
  it('builds base elements and resolves id and reference attributes (for, aria-*) with UUIDs', () => {
    class MyComponent extends TComponent<HTMLDivElement> {
      static template = `
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

  it('resolves multiple space-separated IDs and preserves unresolvable/custom component IDs', () => {
    class MultiIdComponent extends TComponent<HTMLDivElement> {
      static template = `
        <div>
          <h1 id="title-1">Title</h1>
          <p id="desc-1">Description</p>
          <div aria-labelledby="title-1 desc-1 unknown-id">Content</div>
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
      'Method "nonExistent" not found on component for event "onclick"',
    );
  });

  it('catches synchronous errors in onerror', () => {
    const controller = new AbortController();
    class SyncErrComp extends TComponent<HTMLButtonElement> {
      static template = `<button onclick="handleSyncError">Error</button>`;
      handleSyncError() {
        throw new Error('Sync Error!');
      }
    }

    const comp = new SyncErrComp({ signal: controller.signal });
    const spy = vi.spyOn(comp, 'onerror').mockImplementation(() => {});

    comp.element.click();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Sync Error!' }),
    );
  });

  it('catches asynchronous (Promise) errors in onerror', async () => {
    const controller = new AbortController();
    class AsyncErrComp extends TComponent<HTMLButtonElement> {
      static template = `<button onclick="handleAsyncError">Async Error</button>`;
      async handleAsyncError() {
        throw new Error('Async Error!');
      }
    }

    const comp = new AsyncErrComp({ signal: controller.signal });
    const spy = vi.spyOn(comp, 'onerror').mockImplementation(() => {});

    comp.element.click();
    await Promise.resolve();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Async Error!' }),
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
    static template = `
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
      static template = `
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

    const parsedUses = CachedParent.parsedUses;
    expect(parsedUses).toBeDefined();
    expect(parsedUses).toHaveProperty('mycustomchild');
  });
});

describe('Namespaces (SVG & MathML)', () => {
  it('creates elements with correct namespace URIs and handles foreignObject correctly', () => {
    class NamespaceComponent extends TComponent<HTMLDivElement> {
      static template = `
        <div>
          <!-- SVG Scope -->
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" onclick="handleSvgClick" />
            <!-- foreignObject (case-insensitive in parsed TNode) -->
            <foreignObject width="100" height="100">
              <div class="html-in-svg">I am HTML inside SVG</div>
            </foreignObject>
          </svg>

          <!-- MathML Scope -->
          <math>
            <mi>x</mi>
            <mo>+</mo>
            <mi>y</mi>
          </math>
        </div>
      `;

      public svgClickCount = 0;
      handleSvgClick() {
        this.svgClickCount++;
      }
    }

    const controller = new AbortController();
    const comp = new NamespaceComponent({ signal: controller.signal });

    const HTML_NS = 'http://www.w3.org/1999/xhtml';
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const MATHML_NS = 'http://www.w3.org/1998/Math/MathML';

    expect(comp.element.namespaceURI).toBe(HTML_NS);

    const svg = comp.element.querySelector('svg')!;
    const circle = comp.element.querySelector('circle')!;
    expect(svg.namespaceURI).toBe(SVG_NS);
    expect(circle.namespaceURI).toBe(SVG_NS);

    const foreignObj = comp.element.querySelector('foreignobject')!;
    const divInSvg = comp.element.querySelector('.html-in-svg')!;
    expect(foreignObj.namespaceURI).toBe(SVG_NS);
    expect(divInSvg.namespaceURI).toBe(HTML_NS);

    const math = comp.element.querySelector('math')!;
    const mi = comp.element.querySelector('mi')!;
    expect(math.namespaceURI).toBe(MATHML_NS);
    expect(mi.namespaceURI).toBe(MATHML_NS);

    circle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(comp.svgClickCount).toBe(1);
  });
});
