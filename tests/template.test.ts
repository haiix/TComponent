import { describe, expect, it, vi } from 'vitest';
import { TComponent } from '../src/TComponent';
import { BuildContext } from '../src/BuildContext';
import type { AbstractComponent } from '../src/AbstractComponent';
import { applyParams } from '../src/utils/applyParams';
import type { ComponentParams, ParsedTemplateData, TNode } from '../src/types';

// Deliberately bypass readonly types to exercise runtime protection.
interface MutableNode {
  t: string;
  a: Record<string, string>;
  c: (MutableNode | string)[];
}

describe('Read-only template cache', () => {
  it('freezes every node, attribute dictionary and child array once per class', () => {
    class Example extends TComponent {
      static template =
        '<div class="root">Text<section><template><b title="nested">Leaf</b></template></section></div>';
    }
    const freeze = vi.spyOn(Object, 'freeze');
    try {
      const parsed = Example.getParsed();
      const check = (node: TNode): void => {
        expect(Object.isFrozen(node)).toBe(true);
        expect(Object.isFrozen(node.a)).toBe(true);
        expect(Object.isFrozen(node.c)).toBe(true);
        for (const child of node.c) {
          if (typeof child !== 'string') check(child);
        }
      };
      check(parsed.template);
      expect(Object.isFrozen(parsed)).toBe(true);
      expect(Object.isFrozen(parsed.uses)).toBe(true);
      const calls = freeze.mock.calls.length;
      expect(calls).toBeGreaterThan(0);
      expect(Example.getParsed()).toBe(parsed);
      new Example();
      new Example();
      expect(freeze).toHaveBeenCalledTimes(calls);

      class Derived extends Example {}
      const derived = Derived.getParsed();
      expect(derived).not.toBe(parsed);
      expect(derived.template).not.toBe(parsed.template);
      check(derived.template);
    } finally {
      freeze.mockRestore();
    }
  });

  it('prevents replacing the exposed cache and uses without freezing classes', () => {
    class Child extends TComponent {}
    class Parent extends TComponent {
      static uses = { Child };
    }
    const parsed = Parent.getParsed();
    const mutable = parsed as {
      template: TNode;
      ns?: string;
      uses: Record<string, typeof AbstractComponent>;
    };
    expect(() => {
      mutable.template = { t: 'span', a: {}, c: [] };
    }).toThrow(TypeError);
    expect(() => {
      mutable.ns = 'changed';
    }).toThrow(TypeError);
    expect(() => {
      mutable.uses = {};
    }).toThrow(TypeError);
    expect(() => {
      mutable.uses.child = Parent;
    }).toThrow(TypeError);
    expect(() => {
      delete mutable.uses.child;
    }).toThrow(TypeError);
    expect(() => {
      (parsed.template as MutableNode).t = 'span';
    }).toThrow(TypeError);
    expect(Object.isFrozen(Parent.uses)).toBe(false);
    expect(Object.isFrozen(Child)).toBe(false);
    expect(Object.isFrozen(Child.prototype)).toBe(false);
    Child.template = '<button>Changed</button>';
    expect(new Child().element.tagName).toBe('BUTTON');
    expect(Parent.getParsed()).toBe(parsed);
  });

  const mutations: [string, (node: MutableNode) => void][] = [
    [
      'attribute assignment',
      (node) => {
        node.a.value = 'changed';
      },
    ],
    [
      'attribute deletion',
      (node) => {
        delete node.a.value;
      },
    ],
    [
      'ID deletion',
      (node) => {
        delete node.a.id;
      },
    ],
    [
      'child insertion',
      (node) => {
        node.c.push('changed');
      },
    ],
    [
      'child removal',
      (node) => {
        node.c.splice(0, 1);
      },
    ],
    [
      'nested tag assignment',
      (node) => {
        (node.c[0] as MutableNode).t = 'b';
      },
    ],
    [
      'nested attribute assignment',
      (node) => {
        (node.c[0] as MutableNode).a.title = 'changed';
      },
    ],
    [
      'nested child insertion',
      (node) => {
        (node.c[0] as MutableNode).c.push('changed');
      },
    ],
  ];

  it.each(mutations)(
    'blocks %s in child constructors and preserves subsequent instances',
    (_name, mutate) => {
      class Child extends TComponent {
        constructor(params: ComponentParams) {
          super(params);
          mutate({
            t: 'child',
            a: params.attributes!,
            c: params.childNodes!,
          } as MutableNode);
        }
      }
      class Parent extends TComponent {
        static uses = { Child };
        static template =
          '<div><child id="child" value="initial"><span title="original">Slot</span></child></div>';
      }
      const parsed = Parent.getParsed();
      const snapshot = JSON.stringify(parsed.template);
      expect(() => new Parent()).toThrow(TypeError);
      expect(() => new Parent()).toThrow(TypeError);
      expect(JSON.stringify(parsed.template)).toBe(snapshot);
      const node = parsed.template.c[0] as MutableNode;
      expect(() => {
        mutate(node);
      }).toThrow(TypeError);
      expect(JSON.stringify(parsed.template)).toBe(snapshot);
    },
  );

  it('shares immutable inputs while preserving slots, IDs, events and lifecycle', () => {
    const received: ComponentParams[] = [];
    const click = vi.fn();
    class Child extends TComponent {
      constructor(params: ComponentParams) {
        super(params);
        received.push(params);
        applyParams(this, this.element, params);
      }
    }
    class Parent extends TComponent {
      static uses = { Child };
      static template =
        '<div><child id="child" value="initial"><label for="input">Label</label><input id="input"><button id="button" onclick="handleClick">Slot</button></child></div>';
      handleClick() {
        click();
      }
    }
    const first = new Parent();
    const second = new Parent();
    const node = Parent.getParsed().template.c[0] as TNode;
    expect(received[0]!.attributes).toBe(node.a);
    expect(received[1]!.attributes).toBe(node.a);
    expect(received[0]!.childNodes).toBe(node.c);
    expect(received[1]!.childNodes).toBe(node.c);
    for (const parent of [first, second]) {
      const child = parent.getById('child', Child);
      expect(child.element.getAttribute('value')).toBe('initial');
      expect(child.element.textContent).toBe('LabelSlot');
      expect(child.element.querySelector('label')!.htmlFor).toBe(
        parent.getById('input', HTMLInputElement).id,
      );
      const button = parent.getById('button', HTMLButtonElement);
      button.click();
      child.destroy();
      expect(child.signal.aborted).toBe(true);
      button.click();
      parent.destroy();
    }
    expect(click).toHaveBeenCalledTimes(2);
  });

  it('allows explicit copies and dynamic AST construction without freezing caller inputs', () => {
    const parsed = TComponent.getParsed();
    const attributes: Record<string, string> = {
      ...parsed.template.a,
      value: 'initial',
    };
    const children = [{ t: 'span', a: { title: 'original' }, c: ['Slot'] }];
    const controller = new AbortController();
    const params = {
      attributes,
      childNodes: children,
      signal: controller.signal,
    };
    const component = new TComponent(params);
    const context = new BuildContext(component, {});
    const root = { ...parsed.template, a: attributes, c: children };
    delete attributes.value;
    children[0]!.a.title = 'changed';
    children[0]!.c.push(' copied');
    children.push({ t: 'b', a: { title: 'added' }, c: ['New'] });
    expect(context.build(root).textContent).toBe('Slot copiedNew');
    expect(parsed.template.c).toHaveLength(0);
    for (const value of [
      params,
      attributes,
      children,
      children[0],
      controller.signal,
      component,
    ]) {
      expect(Object.isFrozen(value)).toBe(false);
    }
    controller.abort();
    expect(component.signal.aborted).toBe(true);
  });

  it('rejects direct writes in public types and permits copies', () => {
    // Type-checked but not invoked: runtime mutation protection is tested above.
    expect(
      (params: ComponentParams, parsed: ParsedTemplateData, node: TNode) => {
        // @ts-expect-error Template attributes are readonly.
        params.attributes!.value = 'changed';
        // @ts-expect-error Template attributes cannot be deleted.
        delete params.attributes!.value;
        // @ts-expect-error The attributes input cannot be replaced.
        params.attributes = {};
        // @ts-expect-error The childNodes input cannot be replaced.
        params.childNodes = [];
        // @ts-expect-error Slot arrays are readonly.
        params.childNodes[0] = 'changed';
        // @ts-expect-error AST tags are readonly.
        node.t = 'span';
        // @ts-expect-error AST attribute dictionaries cannot be replaced.
        node.a = {};
        // @ts-expect-error AST child arrays cannot be replaced.
        node.c = [];
        // @ts-expect-error Nested AST attributes are readonly.
        node.a.value = 'changed';
        // @ts-expect-error Nested AST arrays are readonly.
        node.c[0] = 'changed';
        // @ts-expect-error Cached templates cannot be replaced.
        parsed.template = node;
        // @ts-expect-error Cached namespaces cannot be replaced.
        parsed.ns = 'changed';
        // @ts-expect-error Cached uses cannot be replaced.
        parsed.uses = {};
        // @ts-expect-error Cached component registrations are readonly.
        parsed.uses.child = TComponent;
        const attributes = { ...params.attributes };
        delete attributes.value;
        const children = [...(params.childNodes ?? [])];
        children.push('copied');
        const copied = { ...node, a: { ...node.a }, c: [...node.c] };
        copied.t = 'span';
        copied.a.value = 'copied';
        copied.c.push('copied');
        new BuildContext(new TComponent(), parsed.uses).build(copied);
      },
    ).toBeTypeOf('function');
  });

  it('allows recursive copies to change descendants while shallow copies keep them frozen', () => {
    class Example extends TComponent {
      static template =
        '<div><section><span title="original">Slot</span></section></div>';
    }
    const original = Example.getParsed().template;
    const shallow = [...original.c];
    expect(() => {
      (shallow[0] as MutableNode).a.class = 'changed';
    }).toThrow(TypeError);
    const copyNode = (node: TNode): MutableNode => ({
      t: node.t,
      a: { ...node.a },
      c: node.c.map((child) =>
        typeof child === 'string' ? child : copyNode(child),
      ),
    });
    const copied = copyNode(original);
    const section = copied.c[0] as MutableNode;
    const span = section.c[0] as MutableNode;
    span.a.title = 'changed';
    span.c.push(' copied');
    section.c.push('New');
    const component = new Example();
    const built = component.context.build(copied);
    expect(built.textContent).toBe('Slot copiedNew');
    expect(built.querySelector('span')!.title).toBe('changed');
    expect(new Example().element.outerHTML).toBe(
      '<div><section><span title="original">Slot</span></section></div>',
    );
    expect(Example.getParsed().template).toBe(original);
  });
});
