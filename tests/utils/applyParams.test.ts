import { describe, it, expect, vi } from 'vitest';
import type { ComponentParams } from '../../src/types';
import { TComponent } from '../../src/TComponent';
import { applyParams } from '../../src/utils/applyParams';

describe('applyParams', () => {
  it.each([
    'sprite.svg#icon',
    'https://example.com/sprite.svg#icon',
    '#icon',
    '#missing',
    '#',
    '',
  ])('sets SVG xlink:href "%s" with the XLink namespace', (value) => {
    class SvgUse extends TComponent {
      static namespaceURI = 'http://www.w3.org/2000/svg';
      static template = '<use></use>';
      constructor(params: ComponentParams) {
        super(params);
        applyParams(this, this.element, params);
      }
    }
    const attributes = Object.freeze({ 'xlink:href': value });
    const component = new SvgUse({ attributes });
    const icon = document.createElementNS(SvgUse.namespaceURI, 'path');
    component.context.idMap.icon = icon;
    const deferred = value === '#icon' || value === '#missing';
    expect(component.context.idReferenceMap).toHaveLength(deferred ? 1 : 0);
    expect(
      component.element.getAttributeNS('http://www.w3.org/1999/xlink', 'href'),
    ).toBe(deferred ? null : value);

    component.context.resolveIdReferences();

    const expected = value === '#icon' ? `#${icon.id}` : value;
    expect(Boolean(icon.id)).toBe(value === '#icon');
    expect(component.element.getAttribute('xlink:href')).toBe(expected);
    expect(
      component.element.getAttributeNS('http://www.w3.org/1999/xlink', 'href'),
    ).toBe(expected);
    expect(component.element.getAttributeNode('xlink:href')?.namespaceURI).toBe(
      'http://www.w3.org/1999/xlink',
    );
    expect(component.context.idReferenceMap).toHaveLength(0);
    expect(attributes['xlink:href']).toBe(value);
  });

  it('updates an existing namespaced SVG reference with an external URL', () => {
    class Graphic extends TComponent {
      static template =
        '<svg><path id="icon"></path><use xlink:href="#icon"></use></svg>';
    }
    const component = new Graphic();
    const target = component.element.querySelector('use')!;
    applyParams(component, target, {
      attributes: { 'xlink:href': 'sprite.svg#icon' },
    });
    component.context.resolveIdReferences();

    expect(target.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBe(
      'sprite.svg#icon',
    );
    expect(target.getAttributeNode('xlink:href')?.namespaceURI).toBe(
      'http://www.w3.org/1999/xlink',
    );
    expect(target.attributes).toHaveLength(1);
  });

  it.each(['OnClick', 'ONCLICK'])(
    'binds "%s" in the parent scope and unbinds it when the child is destroyed',
    (name) => {
      class Parent extends TComponent {
        handleEvent = vi.fn();
      }
      const parent = new Parent();
      const child = new TComponent({ parent });
      const attributes = Object.freeze({ [name]: 'handleEvent' });

      applyParams(child, child.element, { attributes });
      expect(child.element.hasAttribute('onclick')).toBe(false);
      child.element.dispatchEvent(new MouseEvent('click'));
      expect(parent.handleEvent).toHaveBeenCalledExactlyOnceWith(
        expect.any(MouseEvent),
      );
      child.destroy();
      child.element.dispatchEvent(new MouseEvent('click'));
      expect(parent.handleEvent).toHaveBeenCalledTimes(1);
      expect(attributes[name]).toBe('handleEvent');
    },
  );

  it.each(['OnClick', 'ONCLICK'])(
    'rejects inline code in "%s" before setting an event attribute',
    (name) => {
      const component = new TComponent();
      expect(() => {
        applyParams(component, component.element, {
          attributes: { [name]: 'window.inlineRan = true' },
        });
      }).toThrow(/SecurityError: Invalid event handler signature/);
      expect(component.element.hasAttribute('onclick')).toBe(false);
    },
  );

  it.each(['ID', 'Id'])(
    'ignores "%s" without overwriting the existing DOM ID',
    (name) => {
      const component = new TComponent();
      component.element.id = 'original-id';
      applyParams(component, component.element, {
        attributes: { [name]: 'shared-id' },
      });
      expect(component.element.id).toBe('original-id');
    },
  );

  it('normalizes HTML references and merges attributes without mutating the input', () => {
    class Form extends TComponent {
      static template = '<div><input id="input"></div>';
    }
    const form = new Form();
    const target = document.createElement('label');
    target.className = 'base';
    target.setAttribute('style', 'color: blue;');
    const attributes = Object.freeze({
      FOR: 'input',
      'ARIA-LABELLEDBY': 'input',
      CLASS: 'first',
      class: 'second',
      STYLE: 'margin: 10px;',
    });

    applyParams(form, target, { attributes });
    expect(target.hasAttribute('for')).toBe(false);
    expect(target.hasAttribute('aria-labelledby')).toBe(false);
    expect(form.context.idReferenceMap.map(({ attrName }) => attrName)).toEqual(
      ['for', 'aria-labelledby'],
    );
    form.context.resolveIdReferences();
    const input = form.getById('input', HTMLInputElement);
    expect(input.id).not.toBe('');
    expect(target.htmlFor).toBe(input.id);
    expect(target.getAttribute('aria-labelledby')).toBe(input.id);
    expect(target.className).toBe('base first second');
    expect(target.getAttribute('style')).toBe('color: blue; margin: 10px;');
    expect(attributes.FOR).toBe('input');
    expect(attributes['ARIA-LABELLEDBY']).toBe('input');
  });

  it.each([
    ['#first', 'https://example.com/'],
    ['https://example.com/', '#second'],
    ['#first', '#second'],
  ])(
    'uses the later normalized href when applying "%s" followed by "%s"',
    (earlier, later) => {
      class Links extends TComponent {
        static template =
          '<div><span id="first"></span><span id="second"></span></div>';
      }
      const component = new Links();
      const target = document.createElement('a');
      const attributes = Object.freeze({ HREF: earlier, href: later });

      applyParams(component, target, { attributes });
      expect(component.context.idReferenceMap).toHaveLength(
        later === '#second' ? 1 : 0,
      );
      component.context.resolveIdReferences();
      const first = component.getById('first', HTMLSpanElement);
      const second = component.getById('second', HTMLSpanElement);
      expect(first.id).toBe('');
      expect(Boolean(second.id)).toBe(later === '#second');
      expect(target.getAttribute('href')).toBe(
        later === '#second' ? `#${second.id}` : later,
      );
      expect(attributes).toEqual({ HREF: earlier, href: later });
    },
  );

  it('preserves SVG attribute case when applying parameters', () => {
    const component = new TComponent();
    const target = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg',
    );
    const attributes = Object.freeze({ viewBox: '0 0 10 10' });
    applyParams(component, target, { attributes });

    expect(target.getAttribute('viewBox')).toBe(attributes.viewBox);
    expect(target.hasAttribute('viewbox')).toBe(false);
  });

  it.each([
    'https://example.com/page#section',
    '/page#section',
    'other.svg#shape',
    '#',
    '',
  ])(
    'immediately applies nonlocal href "%s" in a standalone constructor',
    (href) => {
      class Link extends TComponent<HTMLAnchorElement> {
        static template = '<a href="initial">Go</a>';
        constructor(params: ComponentParams) {
          super(params);
          applyParams(this, this.element, params);
        }
      }
      const attributes = Object.freeze({ href });
      const link = new Link({ attributes });
      expect(link.element.getAttribute('href')).toBe(href);
      expect(link.context.idReferenceMap).toHaveLength(0);
      expect(attributes.href).toBe(href);
    },
  );

  it('immediately applies SVG values without local references in a standalone constructor', () => {
    class Graphic extends TComponent {
      static template = '<svg><path id="shape" fill="blue"></path></svg>';
      constructor(params: ComponentParams) {
        super(params);
        applyParams(this, this.getById('shape', SVGElement), params);
      }
    }
    const attributes = Object.freeze({
      href: 'other.svg#shape',
      'xlink:href': 'other.svg#shape',
      fill: 'red',
      stroke: 'url("other.svg#paint") red',
      filter: 'none',
      'clip-path': 'url(https://example.com/image.svg#clip)',
      mask: '',
      marker: 'none',
      'marker-start': 'none',
      'marker-mid': 'none',
      'marker-end': 'none',
    });
    const graphic = new Graphic({ attributes });
    const target = graphic.getById('shape', SVGElement);
    for (const [name, value] of Object.entries(attributes)) {
      expect(target.getAttribute(name)).toBe(value);
    }
    expect(graphic.context.idReferenceMap).toHaveLength(0);
    expect(target.id).toBe('');
  });

  it('only defers local references when mixed with immediately applied attributes', () => {
    class Graphic extends TComponent {
      static template = '<svg><path id="shape"></path></svg>';
    }
    const graphic = new Graphic();
    const target = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'use',
    );
    const attributes = Object.freeze({
      href: 'other.svg#shape',
      fill: 'url("other.svg#paint") url( \'#shape\' ) red',
      stroke: 'red',
      filter: 'url(#missing)',
      mask: 'url(#shape)',
      'marker-start': 'url(#shape)',
    });
    applyParams(graphic, target, { attributes });
    expect(target.getAttribute('href')).toBe(attributes.href);
    expect(target.getAttribute('stroke')).toBe('red');
    expect(target.hasAttribute('fill')).toBe(false);
    expect(
      graphic.context.idReferenceMap.map(({ attrName }) => attrName),
    ).toEqual(['fill', 'filter', 'mask', 'marker-start']);
    graphic.context.resolveIdReferences();
    const shape = graphic.getById('shape', SVGElement);
    expect(shape.id).not.toBe('');
    expect(target.getAttribute('fill')).toBe(
      `url("other.svg#paint") url( '#${shape.id}' ) red`,
    );
    expect(target.getAttribute('filter')).toBe('url(#missing)');
    expect(target.getAttribute('mask')).toBe(`url(#${shape.id})`);
    expect(target.getAttribute('marker-start')).toBe(`url(#${shape.id})`);
    expect(attributes.fill).toBe(
      'url("other.svg#paint") url( \'#shape\' ) red',
    );
  });

  it.each(['before', 'after'] as const)(
    'resolves forwarded href against a parent target %s the child, ignoring matching child IDs',
    (position) => {
      class Link extends TComponent {
        static template =
          '<div><a id="link"></a><span id="section"></span></div>';
        constructor(params: ComponentParams) {
          super(params);
          applyParams(this, this.getById('link', HTMLAnchorElement), params);
        }
      }
      const target = '<section id="section"></section>';
      const link = '<link-view id="link" href="#section"></link-view>';
      class App extends TComponent {
        static uses = { 'link-view': Link };
        static template = `<div>${position === 'before' ? target + link : link + target}</div>`;
      }
      const app = new App();
      const child = app.getById('link', Link);
      const section = app.getById('section', HTMLElement);
      expect(section.id).not.toBe('');
      expect(
        child.getById('link', HTMLAnchorElement).getAttribute('href'),
      ).toBe(`#${section.id}`);
      expect(child.getById('section', HTMLElement).id).toBe('');
      expect(child.element.hasAttribute('href')).toBe(false);
      expect(app.context.idReferenceMap).toHaveLength(0);
    },
  );

  it('resolves forwarded SVG fragments and URLs against parent siblings and slots', () => {
    class Group extends TComponent {
      static namespaceURI = 'http://www.w3.org/2000/svg';
      static template = '<g><use id="use"></use><path id="shape"></path></g>';
      constructor(params: ComponentParams) {
        super(params);
        applyParams(this, this.getById('use', SVGElement), params);
      }
    }
    class Graphic extends TComponent {
      static uses = { Group };
      static template = `<svg>
        <group id="group" href="#shape" xlink:href="#shape" fill="url('#paint') red" filter="url(#private)">
          <linearGradient id="paint"></linearGradient>
        </group>
        <path id="shape"></path>
      </svg>`;
    }
    const graphic = new Graphic();
    const group = graphic.getById('group', Group);
    const use = group.getById('use', SVGElement);
    const shape = graphic.getById('shape', SVGElement);
    const paint = graphic.getById('paint', SVGElement);
    expect(shape.id).not.toBe('');
    expect(paint.id).not.toBe('');
    expect(use.getAttribute('href')).toBe(`#${shape.id}`);
    expect(use.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBe(
      `#${shape.id}`,
    );
    expect(use.getAttribute('fill')).toBe(`url('#${paint.id}') red`);
    expect(use.getAttribute('filter')).toBe('url(#private)');
    expect(use.contains(paint)).toBe(true);
    expect(group.getById('shape', SVGElement).id).toBe('');
  });

  it('resolves own-context fragments explicitly without mutating parameters', () => {
    class Graphic extends TComponent {
      static template = '<svg><path id="shape"></path></svg>';
    }
    const graphic = new Graphic();
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    const attributes = Object.freeze({
      href: '#shape',
      'xlink:href': 'other.svg#shape',
      fill: 'url(#shape)',
      mask: 'url(#missing)',
    });
    applyParams(graphic, use, { attributes });
    graphic.context.resolveIdReferences();
    const shape = graphic.getById('shape', SVGElement);
    expect(shape.id).not.toBe('');
    expect(use.getAttribute('href')).toBe(`#${shape.id}`);
    expect(use.getAttribute('fill')).toBe(`url(#${shape.id})`);
    expect(use.getAttribute('xlink:href')).toBe('other.svg#shape');
    expect(use.getAttribute('mask')).toBe('url(#missing)');
    expect(attributes.href).toBe('#shape');
    expect(attributes.fill).toBe('url(#shape)');
  });

  it('builds circle slots in the SVG namespace of a receiving Group component', () => {
    class Group extends TComponent {
      static namespaceURI = 'http://www.w3.org/2000/svg';
      static template = '<g></g>';

      constructor(params: ComponentParams) {
        super(params);
        applyParams(this, this.element, params);
      }
    }
    class Graphic extends TComponent {
      static uses = { Group };
      static template =
        '<svg><group><circle cx="10" cy="10" r="5"></circle></group></svg>';
    }
    const graphic = new Graphic();
    const group = graphic.element.firstElementChild;
    const circle = group?.firstElementChild;
    expect(group?.namespaceURI).toBe(Group.namespaceURI);
    expect(circle?.namespaceURI).toBe(Group.namespaceURI);
    expect(circle).toBeInstanceOf(SVGElement);
    expect(circle?.getAttribute('cx')).toBe('10');
    expect(circle?.getAttribute('cy')).toBe('10');
    expect(circle?.getAttribute('r')).toBe('5');
  });

  it('uses forwarded encoding when inserting slots into MathML annotation-xml', () => {
    class Annotation extends TComponent {
      static namespaceURI = 'http://www.w3.org/1998/Math/MathML';
      static template = '<annotation-xml></annotation-xml>';

      constructor(params: ComponentParams) {
        super(params);
        applyParams(this, this.element, params);
      }
    }
    class Formula extends TComponent {
      static uses = { 'annotation-view': Annotation };
      static template =
        '<div><annotation-view encoding="text/html"><span>Label</span></annotation-view></div>';
    }
    const formula = new Formula();
    const annotation = formula.element.firstElementChild;
    expect(annotation?.namespaceURI).toBe(Annotation.namespaceURI);
    expect(annotation?.getAttribute('encoding')).toBe('text/html');
    expect(annotation?.firstElementChild).toBeInstanceOf(HTMLSpanElement);
    expect(annotation?.textContent).toBe('Label');
  });

  class Wrapper extends TComponent {
    static template = '<div><section id="body"></section></div>';

    constructor(params: ComponentParams = {}) {
      super(params);
      applyParams(this, this.getById('body', HTMLElement), params);
    }
  }

  class Label extends TComponent<HTMLLabelElement> {
    static template = '<label></label>';

    constructor(params: ComponentParams) {
      super(params);
      applyParams(this, this.element, params);
    }
  }

  it.each(['before', 'after'] as const)(
    'resolves forwarded form attributes when the parent form is %s the controls',
    (position) => {
      class Controls extends TComponent {
        static template =
          '<section><input id="input" name="q" value="query"><button id="save" type="submit">Save</button><form id="f"></form></section>';

        constructor(params: ComponentParams) {
          super(params);
          applyParams(this, this.getById('input', HTMLInputElement), params);
          applyParams(this, this.getById('save', HTMLButtonElement), params);
        }
      }
      const formTemplate = '<form id="f"></form>';
      const controlsTemplate = '<controls id="controls" form="f"></controls>';
      class App extends TComponent {
        static uses = { Controls };
        static template = `<div>${
          position === 'before'
            ? formTemplate + controlsTemplate
            : controlsTemplate + formTemplate
        }</div>`;
      }

      const app = new App();
      document.body.append(app.element);
      try {
        const form = app.getById('f', HTMLFormElement);
        const controls = app.getById('controls', Controls);
        const input = controls.getById('input', HTMLInputElement);
        const button = controls.getById('save', HTMLButtonElement);
        expect(form.id).toMatch(/^uid-|^[0-9a-f-]{36}$/);
        expect(input.getAttribute('form')).toBe(form.id);
        expect(button.getAttribute('form')).toBe(form.id);
        expect(input.form).toBe(form);
        expect(button.form).toBe(form);
        expect(Array.from(form.elements)).toEqual([input, button]);
        expect(new FormData(form).get('q')).toBe('query');
        expect(controls.getById('f', HTMLFormElement).id).toBe('');
        expect(controls.element.hasAttribute('form')).toBe(false);
        expect(app.context.idReferenceMap).toHaveLength(0);

        const submit = vi.fn((event: Event) => {
          event.preventDefault();
        });
        form.addEventListener('submit', submit);
        button.click();
        expect(submit).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ submitter: button }),
        );
      } finally {
        app.element.remove();
      }
    },
  );

  it.each(['before', 'after'] as const)(
    'resolves a forwarded for attribute when the parent input is %s the label',
    (position) => {
      const inputTemplate = '<input id="input">';
      const labelTemplate = '<label-comp for="input">Name</label-comp>';
      class Form extends TComponent {
        static uses = { 'label-comp': Label };
        static template = `<div>${
          position === 'before'
            ? inputTemplate + labelTemplate
            : labelTemplate + inputTemplate
        }</div>`;
      }

      const first = new Form();
      const second = new Form();
      for (const form of [first, second]) {
        const label = form.element.querySelector('label')!;
        const input = form.getById('input', HTMLInputElement);
        expect(input.id).toMatch(/^uid-|^[0-9a-f-]{36}$/);
        expect(label.htmlFor).toBe(input.id);
        expect(label.textContent).toBe('Name');
        expect(form.context.idReferenceMap).toHaveLength(0);
      }
      expect(first.getById('input', HTMLInputElement).id).not.toBe(
        second.getById('input', HTMLInputElement).id,
      );
      expect(Form.getParsed().template.c).toContainEqual(
        expect.objectContaining({ a: { for: 'input' } }),
      );
    },
  );

  it.each([
    'aria-labelledby',
    'aria-describedby',
    'aria-controls',
    'aria-owns',
    'aria-activedescendant',
    'aria-flowto',
    'aria-errormessage',
    'aria-details',
    'headers',
    'list',
  ])('resolves forwarded %s attributes on an internal target', (attribute) => {
    class App extends TComponent {
      static uses = { Wrapper };
      static template = `
        <div>
          <wrapper id="wrapper" ${attribute}="  title   description unknown  " class="custom" style="color: red" data-info="info">
            <span id="title">Title</span>
          </wrapper>
          <p id="description">Description</p>
        </div>
      `;
    }

    const app = new App();
    const wrapper = app.getById('wrapper', Wrapper);
    const target = wrapper.getById('body', HTMLElement);
    const title = app.getById('title', HTMLSpanElement);
    const description = app.getById('description', HTMLParagraphElement);

    expect(title.id).not.toBe('');
    expect(description.id).not.toBe('');
    expect(target.getAttribute(attribute)).toBe(
      `${title.id} ${description.id} unknown`,
    );
    expect(target.id).toBe('');
    expect(target.className).toBe('custom');
    expect(target.style.color).toBe('red');
    expect(target.getAttribute('data-info')).toBe('info');
    expect(wrapper.element.hasAttribute(attribute)).toBe(false);
  });

  it('keeps forwarded references in the parent scope even when child IDs match', () => {
    class Field extends TComponent {
      static template =
        '<section><input id="input"><span id="private">Private</span></section>';

      constructor(params: ComponentParams) {
        super(params);
        applyParams(this, this.element, params);
      }
    }
    class App extends TComponent {
      static uses = { Field };
      static template =
        '<div><field id="field" aria-labelledby="input private field unknown"></field><input id="input"></div>';
    }

    const app = new App();
    const field = app.getById('field', Field);
    const input = app.getById('input', HTMLInputElement);
    expect(input.id).not.toBe('');
    expect(field.element.getAttribute('aria-labelledby')).toBe(
      `${input.id} private field unknown`,
    );
    expect(field.getById('input', HTMLInputElement).id).toBe('');
    expect(field.getById('private', HTMLSpanElement).id).toBe('');
    expect(field.element.id).toBe('');
  });

  it('queues references in its own context when no TComponent parent is available', () => {
    class Form extends TComponent {
      static template = '<div><input id="input"></div>';
    }
    const form = new Form();
    const target = document.createElement('label');
    const attributes = Object.freeze({
      for: 'input',
      'aria-labelledby': 'missing',
    });

    applyParams(form, target, { attributes });
    expect(form.context.idReferenceMap).toHaveLength(2);
    expect(target.hasAttribute('for')).toBe(false);
    form.context.resolveIdReferences();

    const input = form.getById('input', HTMLInputElement);
    expect(input.id).not.toBe('');
    expect(target.htmlFor).toBe(input.id);
    expect(target.getAttribute('aria-labelledby')).toBe('missing');
    expect(attributes.for).toBe('input');
  });

  it.each(['wrapper', 'parent'] as const)(
    'unbinds nested slot events when the %s is destroyed while preserving parent scope',
    (destroyTarget) => {
      class App extends TComponent {
        static uses = { Wrapper };
        static template = `
          <div>
            <label for="slotted-button" id="label">Click</label>
            <wrapper id="wrapper">
              <section><button id="slotted-button" aria-labelledby="label" onclick="clicked">Click</button></section>
            </wrapper>
            <button id="outside" onclick="clicked">Outside</button>
          </div>
        `;
        clicked = vi.fn();
      }

      const app = new App();
      const wrapper = app.getById('wrapper', Wrapper);
      const button = app.getById('slotted-button', HTMLButtonElement);
      const label = app.getById('label', HTMLLabelElement);
      const outside = app.getById('outside', HTMLButtonElement);

      expect(wrapper.element.contains(button)).toBe(true);
      expect(label.htmlFor).toBe(button.id);
      expect(button.getAttribute('aria-labelledby')).toBe(label.id);
      button.click();
      expect(app.clicked).toHaveBeenCalledExactlyOnceWith(
        expect.any(MouseEvent),
      );

      (destroyTarget === 'wrapper' ? wrapper : app).destroy();
      button.click();
      expect(app.clicked).toHaveBeenCalledTimes(1);
      outside.click();
      expect(app.clicked).toHaveBeenCalledTimes(
        destroyTarget === 'wrapper' ? 2 : 1,
      );
      expect(app.signal.aborted).toBe(destroyTarget === 'parent');
    },
  );

  it.each(['wrapper', 'parent'] as const)(
    'cleans up custom components and forwarded slots when the %s is destroyed',
    (destroyTarget) => {
      class Slotted extends TComponent {
        static template = '<button onclick="clicked">Slotted</button>';
        clicked = vi.fn();
        cleanup = vi.fn();

        constructor(params: ComponentParams) {
          super(params);
          this.signal.addEventListener('abort', this.cleanup, { once: true });
        }
      }

      class App extends TComponent {
        static uses = { Wrapper, Slotted };
        static template = `
          <div>
            <wrapper id="wrapper">
              <section>
                <slotted id="slotted"></slotted>
                <wrapper id="inner"><button id="forwarded" onclick="clicked">Forwarded</button></wrapper>
              </section>
            </wrapper>
            <slotted id="sibling"></slotted>
          </div>
        `;
        clicked = vi.fn();
        onerror = vi.fn();
      }

      const app = new App();
      const wrapper = app.getById('wrapper', Wrapper);
      const inner = app.getById('inner', Wrapper);
      const slotted = app.getById('slotted', Slotted);
      const sibling = app.getById('sibling', Slotted);
      const button = slotted.element as HTMLButtonElement;
      const forwarded = app.getById('forwarded', HTMLButtonElement);

      expect(slotted.parent).toBe(app);
      expect(inner.parent).toBe(app);
      const error = new Error('slot error');
      slotted.onerror(error);
      expect(app.onerror).toHaveBeenCalledWith(error);
      button.click();
      forwarded.click();
      expect(slotted.clicked).toHaveBeenCalledTimes(1);
      expect(app.clicked).toHaveBeenCalledTimes(1);

      (destroyTarget === 'wrapper' ? wrapper : app).destroy();
      button.click();
      forwarded.click();
      expect(slotted.clicked).toHaveBeenCalledTimes(1);
      expect(app.clicked).toHaveBeenCalledTimes(1);
      expect(inner.signal.aborted).toBe(true);
      expect(slotted.signal.aborted).toBe(true);
      expect(slotted.cleanup).toHaveBeenCalledTimes(1);
      sibling.element.dispatchEvent(new MouseEvent('click'));
      expect(sibling.clicked).toHaveBeenCalledTimes(
        destroyTarget === 'wrapper' ? 1 : 0,
      );
      expect(sibling.cleanup).toHaveBeenCalledTimes(
        destroyTarget === 'wrapper' ? 0 : 1,
      );
      wrapper.destroy();
      expect(slotted.cleanup).toHaveBeenCalledTimes(1);
    },
  );

  it('orchestrates applyAttributes and appendSlots when params are provided', () => {
    class TestComponent extends TComponent {
      static template = `<div></div>`;
    }
    const comp = new TestComponent();
    const targetEl = document.createElement('div');

    const params: ComponentParams = {
      attributes: { class: 'test-class', 'data-info': 'info' },
      childNodes: ['Hello Slots'],
    };

    applyParams(comp, targetEl, params);

    expect(targetEl.className).toBe('test-class');
    expect(targetEl.getAttribute('data-info')).toBe('info');
    expect(targetEl.childNodes[0]?.textContent).toBe('Hello Slots');
  });

  it('binds events to the parent context successfully', () => {
    class ParentComponent extends TComponent {
      static template = `<div></div>`;
      handleEvent = vi.fn();
    }
    const parent = new ParentComponent();

    class ChildComponent extends TComponent {
      static template = `<div></div>`;
    }
    const child = new ChildComponent({ parent });

    const targetEl = document.createElement('div');

    const params: ComponentParams = { attributes: { onclick: 'handleEvent' } };

    // Apply params onto targetEl
    applyParams(child, targetEl, params);

    // Simulate click
    targetEl.click();

    // Event should be resolved in the parent's context
    expect(parent.handleEvent).toHaveBeenCalledTimes(1);
  });

  it('unbinds events properly when the child component is destroyed (lifecycle binding)', () => {
    class ParentComponent extends TComponent {
      static template = `<div></div>`;
      handleEvent = vi.fn();
    }
    const parent = new ParentComponent();

    class ChildComponent extends TComponent {
      static template = `<div></div>`;
    }
    const child = new ChildComponent({ parent });

    const targetEl = document.createElement('div');
    applyParams(child, targetEl, { attributes: { onclick: 'handleEvent' } });

    // Destroying the child should abort the signal and unbind the event
    child.destroy();
    targetEl.click();

    expect(parent.handleEvent).not.toHaveBeenCalled();
  });

  it('does not throw when attributes and childNodes are omitted', () => {
    class TestComponent extends TComponent {
      static template = `<div></div>`;
    }
    const comp = new TestComponent();
    const targetEl = document.createElement('div');

    // Should run smoothly without throwing an error
    applyParams(comp, targetEl, {});

    expect(targetEl.attributes.length).toBe(0);
    expect(targetEl.childNodes.length).toBe(0);
  });
});
