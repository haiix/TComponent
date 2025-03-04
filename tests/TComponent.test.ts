import TComponent, {
  TAttributes,
  bindLabel,
  buildElement,
  getElementById,
  mergeStyles,
  parseTemplate,
} from '../src/TComponent';

/* eslint max-lines-per-function: off */

describe('parseTemplate()', () => {
  test('Tag name', () => {
    const node = parseTemplate('<p></p>');
    expect(node).toHaveProperty('t', 'p');
  });

  test('Closing tags allow spaces', () => {
    const node = parseTemplate('<p></p \n>');
    expect(node).toHaveProperty('t', 'p');
  });

  test('Omitted tag name', () => {
    const node = parseTemplate('<input />');
    expect(node).toHaveProperty('t', 'input');
  });

  test('Attributes', () => {
    const node = parseTemplate('<p foo="bar"></p>');
    expect(node).toHaveProperty('a.foo', 'bar');
  });

  test('Single quote attributes', () => {
    const node = parseTemplate("<p foo='bar'></p>");
    expect(node).toHaveProperty('a.foo', 'bar');
  });

  test('Empty attribute values', () => {
    const node = parseTemplate(`<p foo="" bar=''></p>`);
    expect(node).toHaveProperty('a.foo', '');
    expect(node).toHaveProperty('a.bar', '');
  });

  test('Omitted attributes', () => {
    const node = parseTemplate('<p foo></p>');
    expect(node).toHaveProperty('a.foo', 'foo');
  });

  test('Allow space on the end tag', () => {
    const node = parseTemplate('<p></p \t>');
    expect(node).toHaveProperty('a');
    expect(node).toHaveProperty('t', 'p');
  });

  test('Child nodes', () => {
    const node = parseTemplate(`
      <ul>
        <li>item1</li>
        <li><a href="#">item2</a></li>
      </ul>
    `);
    if (typeof node === 'string') {
      throw new Error('node is not an object');
    }
    expect(node.c).toBeInstanceOf(Array);
    expect(node.c).toHaveLength(2);
    expect(node).toHaveProperty('c[0].t', 'li');
    expect(node).toHaveProperty('c[1].t', 'li');
    if (node.c[1] == null || typeof node.c[1] === 'string') {
      throw new Error('child node is not an object');
    }
    expect(node.c[1].c).toBeInstanceOf(Array);
    expect(node.c[1].c).toHaveLength(1);
  });

  test('Text content', () => {
    const node = parseTemplate('<p>hello</p>');
    if (typeof node === 'string') {
      throw new Error('node is not an object');
    }
    expect(node.c).toBeInstanceOf(Array);
    expect(node.c).toHaveLength(1);
    expect(node.c[0]).toBe('hello');
  });

  test('CDATA', () => {
    const node = parseTemplate('<p> <![CDATA[ <i> hello </i> ]]> </p>');
    if (typeof node === 'string') {
      throw new Error('node is not an object');
    }
    expect(node.c).toBeInstanceOf(Array);
    expect(node.c).toHaveLength(1);
    expect(node.c[0]).toBe(' <i> hello </i> ');
  });

  test('CDATA can have line breaks', () => {
    const node = parseTemplate('<p> <![CDATA[hello\nworld]]> </p>');
    if (typeof node === 'string') {
      throw new Error('node is not an object');
    }
    expect(node.c).toBeInstanceOf(Array);
    expect(node.c).toHaveLength(1);
    expect(node.c[0]).toBe('hello\nworld');
  });

  test('Comments', () => {
    const node = parseTemplate(`
      <body>
        <!-- Some comment -->
        <header>
          <!-- Another comment -->
          <h1>Hello</h1>
        </header>
        <!-- More comment -->
        <section>
        </section>
      </body>
    `);
    if (typeof node === 'string') {
      throw new Error('node is not an object');
    }
    expect(node.c).toBeInstanceOf(Array);
    expect(node.c).toHaveLength(2);
  });

  test('Errors', () => {
    expect(() => {
      parseTemplate('<p /><p>Multi tags</p>');
    }).toThrow(Error);
    expect(() => {
      parseTemplate('<!-- Unexpected end of input');
    }).toThrow(Error);
    expect(() => {
      parseTemplate('<>No tag name< />');
    }).toThrow(Error);
    expect(() => {
      parseTemplate('<a><b>Unexpected end of input</b>');
    }).toThrow(Error);
    expect(() => {
      parseTemplate('<p>Start and end tag name do not match</q>');
    }).toThrow(Error);
    expect(() => {
      parseTemplate('<Tag></Tag is not closed>');
    }).toThrow(Error);
    expect(() => {
      parseTemplate('<a <The start tag is not closed');
    }).toThrow(Error);
    expect(() => {
      parseTemplate('<p a=1>Attribute value does not start with "</p>');
    }).toThrow(Error);
    expect(() => {
      parseTemplate('<![CDATA[ Unexpected end of input');
    }).toThrow(Error);
  });
});

describe('buildElement()', () => {
  test('Element', () => {
    const node = parseTemplate(`
      <label id="nameOfPet">
        <span>Please enter the name of your pet.</span>
        <input onclick="handleClick(event)" />
      </label>
    `);
    const element = buildElement(node);
    expect(element).toBeInstanceOf(HTMLLabelElement);
    expect(element.getAttribute('id')).toBe('nameOfPet');
    expect(element.childElementCount).toBe(2);
    expect(element.children[0]).toBeInstanceOf(HTMLSpanElement);
    const spanElement = element.children[0] as HTMLSpanElement;
    expect(element.children[1]).toBeInstanceOf(HTMLInputElement);
    const inputElement = element.children[1] as HTMLInputElement;
    expect(spanElement.textContent).toBe('Please enter the name of your pet.');
    expect(inputElement.getAttribute('onclick')).toBe('handleClick(event)');
    expect(inputElement.onclick).toBeInstanceOf(Function);
  });

  test('Component', () => {
    const node = parseTemplate(`
      <label id="nameOfPet">
        <span>Please enter the name of your pet.</span>
        <input onclick="this.handleClick(event)" />
      </label>
    `);
    const thisObj = {
      modified: false,
      handleClick() {
        this.modified = true;
      },
    };
    const element = buildElement(node, thisObj);
    expect(element).toBeInstanceOf(HTMLLabelElement);
    expect(element.getAttribute('id')).toBeNull();
    expect(getElementById(thisObj, 'nameOfPet')).toBeInstanceOf(
      HTMLLabelElement,
    );
    expect(element.childElementCount).toBe(2);
    expect(element.children[0]).toBeInstanceOf(HTMLSpanElement);
    const spanElement = element.children[0] as HTMLSpanElement;
    expect(element.children[1]).toBeInstanceOf(HTMLInputElement);
    const inputElement = element.children[1] as HTMLInputElement;
    expect(spanElement.textContent).toBe('Please enter the name of your pet.');
    expect(inputElement.getAttribute('onclick')).toBeNull();
    //expect(inputElement.onclick).toBeInstanceOf(Function);

    expect(thisObj.modified).toBeFalsy();
    inputElement.click();
    expect(thisObj.modified).toBeTruthy();
  });
});

describe('mergeStyles()', () => {
  test('Merges class attributes', () => {
    const element = document.createElement('div');
    element.setAttribute('class', 'existing-class');
    const attrs: TAttributes = { class: 'new-class' };
    mergeStyles(element, attrs);
    expect(element.getAttribute('class')).toBe('existing-class new-class');
  });

  test('Handles empty existing class attribute', () => {
    const element = document.createElement('div');
    const attrs: TAttributes = { class: 'new-class' };
    mergeStyles(element, attrs);
    expect(element.getAttribute('class')).toBe('new-class');
  });

  test('Handles empty new class attribute', () => {
    const element = document.createElement('div');
    element.setAttribute('class', 'existing-class');
    const attrs: TAttributes = { class: '' };
    mergeStyles(element, attrs);
    expect(element.getAttribute('class')).toBe('existing-class');
  });

  test('Merges style attributes', () => {
    const element = document.createElement('div');
    element.setAttribute('style', 'color: red');
    const attrs: TAttributes = { style: 'background: blue' };
    mergeStyles(element, attrs);
    expect(element.getAttribute('style')).toBe('color: red; background: blue');
  });

  test('Handles empty existing style attribute', () => {
    const element = document.createElement('div');
    const attrs: TAttributes = { style: 'background: blue' };
    mergeStyles(element, attrs);
    expect(element.getAttribute('style')).toBe('background: blue');
  });

  test('Handles empty new style attribute', () => {
    const element = document.createElement('div');
    element.setAttribute('style', 'color: red');
    const attrs: TAttributes = { style: '' };
    mergeStyles(element, attrs);
    expect(element.getAttribute('style')).toBe('color: red');
  });

  test('Handles both class and style attributes', () => {
    const element = document.createElement('div');
    element.setAttribute('class', 'existing-class');
    element.setAttribute('style', 'color: red');
    const attrs: TAttributes = {
      class: 'new-class',
      style: 'background: blue',
    };
    mergeStyles(element, attrs);
    expect(element.getAttribute('class')).toBe('existing-class new-class');
    expect(element.getAttribute('style')).toBe('color: red; background: blue');
  });

  test('Handles missing class and style attributes', () => {
    const element = document.createElement('div');
    const attrs: TAttributes = {};
    mergeStyles(element, attrs);
    expect(element.getAttribute('class')).toBeNull();
    expect(element.getAttribute('style')).toBeNull();
  });
});

describe('bindLabel()', () => {
  test('Binds label to target with existing id', () => {
    const labelElem = document.createElement('label');
    const targetElem = document.createElement('input');
    targetElem.id = 'existing-id';
    bindLabel(labelElem, targetElem);
    expect(labelElem.htmlFor).toBe('existing-id');
  });

  test('Binds label to target without id', () => {
    const labelElem = document.createElement('label');
    const targetElem = document.createElement('input');
    bindLabel(labelElem, targetElem);
    expect(labelElem.htmlFor).toMatch(/^t-component-global-id-\d+$/u);
    expect(targetElem.id).toBe(labelElem.htmlFor);
  });

  test('Generates unique ids for multiple targets', () => {
    const labelElem1 = document.createElement('label');
    const targetElem1 = document.createElement('input');
    const labelElem2 = document.createElement('label');
    const targetElem2 = document.createElement('input');
    bindLabel(labelElem1, targetElem1);
    bindLabel(labelElem2, targetElem2);
    expect(labelElem1.htmlFor).not.toBe(labelElem2.htmlFor);
    expect(targetElem1.id).toBe(labelElem1.htmlFor);
    expect(targetElem2.id).toBe(labelElem2.htmlFor);
  });
});

describe('Extends TComponent', () => {
  test('Extends', () => {
    class App extends TComponent {
      static template = `
        <p>Hello</p>
      `;
    }
    expect(Object.hasOwn(App, 'parsedTemplate')).toBe(false);
    const app = new App();
    expect(Object.hasOwn(App, 'parsedTemplate')).toBe(true);
    expect(app.element).toBeInstanceOf(HTMLParagraphElement);
    expect(app.element.textContent).toBe('Hello');
  });

  test('Bind ids', () => {
    class App extends TComponent {
      static template = `
        <section id="section">
          <h2 id="title">here</h2>
          <p>
            It has <b id="bold">some</b> text.
          </p>
        </section>
      `;
      section = this.id('section', HTMLElement);
      title = this.id('title', HTMLHeadingElement);
      bold = this.id('bold', HTMLElement);
    }
    const app = new App();
    expect(app.title).toBeInstanceOf(HTMLHeadingElement);
    expect(app.title.textContent).toBe('here');
    expect(app.bold).toBeInstanceOf(HTMLElement);
    expect(app.bold.textContent).toBe('some');
  });

  test('Bind events', () => {
    class App extends TComponent {
      static template = `
        <p>
          <button
            onclick="this.handleButton(this.name)"
          >My Button</button>
        </p>
      `;

      name = '';
      text = '';

      constructor(name: string) {
        super();
        this.name = name;
      }

      handleButton(name: string) {
        this.text = `${name} Clicked.`;
      }
    }
    const app1 = new App('App1');
    const app2 = new App('App2');
    expect(app1.text).toBe('');
    expect(app2.text).toBe('');
    app2.element.querySelector('button')?.click();
    expect(app1.text).toBe('');
    expect(app2.text).toBe('App2 Clicked.');
    app1.element.querySelector('button')?.click();
    expect(app1.text).toBe('App1 Clicked.');
    expect(app2.text).toBe('App2 Clicked.');
  });

  test('Error handling', () => {
    class App extends TComponent {
      static template = `
        <p>
          <button
            onclick="this.handleButton(event)"
          >My Button</button>
        </p>
      `;

      text = '';

      handleButton() {
        throw new Error('Test error handling.');
      }

      onerror(error: unknown) {
        if (error instanceof Error) {
          this.text = error.message;
        }
      }
    }
    const app = new App();
    expect(app.text).toBe('');
    app.element.querySelector('button')?.click();
    expect(app.text).toBe('Test error handling.');
  });

  test('Async error handling', async () => {
    let callback: ((value: unknown) => void) | null = null;

    class App extends TComponent {
      static template = `
        <p>
          <button
            onclick="this.handleButton(event)"
          >My Button</button>
        </p>
      `;

      text = '';

      async handleButton() {
        await Promise.resolve();
        throw new Error('Test async error handling.');
      }

      onerror(error: unknown) {
        if (error instanceof Error) {
          this.text = error.message;
        }
        if (callback) {
          callback(null);
        }
      }
    }

    const app = new App();
    expect(app.text).toBe('');
    await new Promise((resolve) => {
      callback = resolve;
      app.element.querySelector('button')?.click();
    });
    expect(app.text).toBe('Test async error handling.');
  });

  test('Use sub-component', () => {
    class SubComponent extends TComponent {
      static template = `
        <label id="nameOfPet">
          <span>Please enter the name of your pet.</span>
          <input
            onchange="this.handleChange(event)"
          />
        </label>
      `;

      nameOfPet = this.id('nameOfPet', HTMLElement);
      attrsPassedWhenUsed: TAttributes;
      nodesPassedWhenUsed: Node[];
      modified = false;

      constructor(attrs: TAttributes, nodes: Node[], parent: TComponent) {
        super({}, [], parent);
        this.attrsPassedWhenUsed = attrs;
        this.nodesPassedWhenUsed = nodes;
      }

      handleChange() {
        this.modified = true;
      }
    }
    class App extends TComponent {
      static uses = { SubComponent };
      static template = `
        <section>
          <h1>Use sub component</h1>
          <SubComponent id="myForm1" foo="bar">some text</SubComponent>
          <SubComponent id="myForm2"><p id="myForm2Child">some element</p></SubComponent>
        </section>
      `;

      myForm1 = this.id('myForm1', SubComponent);
      myForm2 = this.id('myForm2', SubComponent);
      myForm2Child = this.id('myForm2Child', HTMLParagraphElement);
    }
    const app = new App();
    expect(app.element).toBeInstanceOf(HTMLElement);
    expect(app.parentComponent).toBeNull();
    expect(app.myForm1).toBeInstanceOf(TComponent);
    expect(app.myForm1.parentComponent).toBe(app);
    expect(app.myForm1.nameOfPet).toBeInstanceOf(HTMLElement);
    expect(app.myForm2).toBeInstanceOf(TComponent);
    expect(app.myForm2.parentComponent).toBe(app);
    expect(app.myForm2Child).toBeInstanceOf(HTMLParagraphElement);
    expect(app.element.childElementCount).toBe(3);
    expect(app.element.children[0]).toBeInstanceOf(HTMLHeadingElement);
    expect(app.element.children[1]).toBe(app.myForm1.element);
    expect(app.myForm1.attrsPassedWhenUsed).toEqual({ foo: 'bar' });
    expect(app.myForm1.nodesPassedWhenUsed).toHaveLength(1);
    expect(app.myForm1.nodesPassedWhenUsed[0]?.textContent).toBe('some text');
    expect(app.myForm2.nodesPassedWhenUsed).toHaveLength(1);
    expect(app.myForm2.nodesPassedWhenUsed[0]).toBe(app.myForm2Child);
  });
});

describe('TComponent.from', () => {
  test('Basic usage', () => {
    const component = new TComponent();
    expect(TComponent.from(component.element)).toBe(component);
  });

  test('Multiple components', () => {
    const component1 = new TComponent();
    const component2 = new TComponent();
    expect(TComponent.from(component1.element)).toBe(component1);
    expect(TComponent.from(component2.element)).toBe(component2);
  });

  test('Irrelevant elements', () => {
    const element = document.createElement('div');
    expect(TComponent.from(element)).toBeNull();
  });

  test('Extended components are taken from their respective classes', () => {
    class ClassA extends TComponent {}
    class ClassB extends ClassA {}
    const ta = new ClassA();
    const tb = new ClassB();
    expect(TComponent.from(ta.element)).toBe(ta);
    expect(TComponent.from(tb.element)).toBe(tb);
    expect(ClassA.from(ta.element)).toBe(ta);
    expect(ClassA.from(tb.element)).toBe(tb);
    expect(ClassB.from(ta.element)).toBeNull();
    expect(ClassB.from(tb.element)).toBe(tb);
  });

  test('When the element is shared, the child component should take precedence', () => {
    class ClassA extends TComponent {
      static template = '<span></span>';
    }
    class ClassB extends TComponent {
      static uses = { ClassA };
      static template = '<ClassA id="a" />';
      ta = this.id('a', ClassA);
    }
    const tb = new ClassB();
    expect(tb.element).toBe(tb.ta.element);
    expect(ClassA.from(tb.ta.element)).toBe(tb.ta);
    expect(ClassB.from(tb.element)).toBeNull();
  });
});
