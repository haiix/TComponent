/**
 * @jest-environment jsdom
 */
import TComponent, { parseTemplate, buildElement, getElementById, TAttributes } from '../src/TComponent';

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
    expect(() => { parseTemplate('<p /><p>Multi tags</p>') }).toThrow(Error);
    expect(() => { parseTemplate('<!-- Unexpected end of input') }).toThrow(Error);
    expect(() => { parseTemplate('<>No tag name< />') }).toThrow(Error);
    expect(() => { parseTemplate('<a><b>Unexpected end of input</b>') }).toThrow(Error);
    expect(() => { parseTemplate('<p>Start and end tag name do not match</q>') }).toThrow(Error);
    expect(() => { parseTemplate('<Tag></Tag is not closed>') }).toThrow(Error);
    expect(() => { parseTemplate('<a <The start tag is not closed') }).toThrow(Error);
    expect(() => { parseTemplate('<p a=1>Attribute value does not start with "</p>') }).toThrow(Error);
    expect(() => { parseTemplate('<![CDATA[ Unexpected end of input') }).toThrow(Error);
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
  })
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
      }
    };
    const element = buildElement(node, thisObj);
    expect(element).toBeInstanceOf(HTMLLabelElement);
    expect(element.getAttribute('id')).toBeNull();
    expect(getElementById(thisObj, 'nameOfPet')).toBeInstanceOf(HTMLLabelElement);
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
        <section>
          <h2 id="title">here</h2>
          <p>
            It has <b id="bold">some</b> text.
          </p>
        </section>
      `;
      title = this.id('title') as HTMLHeadingElement;
      bold = this.id('bold') as HTMLElement;
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
        this.text = name + ' Clicked.';
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

      handleButton(event: MouseEvent) {
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
    class App extends TComponent {
      static template = `
        <p>
          <button
            onclick="this.handleButton(event)"
          >My Button</button>
        </p>
      `;

      text = '';

      async handleButton(event: MouseEvent) {
        throw new Error('Test async error handling.');
      }

      onerror(error: unknown) {
        if (error instanceof Error) {
          this.text = error.message;
        }
      }
    }
    const app = new App();
    expect(app.text).toBe('');
    await app.element.querySelector('button')?.click();
    expect(app.text).toBe('Test async error handling.');
  });

  test('Use sub-component', () => {
    class SubComponent extends TComponent {
      template = `
        <label id="nameOfPet">
          <span>Please enter the name of your pet.</span>
          <input
            onchange="this.handleChange(event)"
          />
        </label>
      `;

      nameOfPet = this.id('nameOfPet') as HTMLElement;
      attrsPassedWhenUsed: TAttributes;
      nodesPassedWhenUsed: Node[];
      modified = false;

      constructor(attrs: TAttributes, nodes: Node[], parent: TComponent) {
        super();
        this.attrsPassedWhenUsed = attrs;
        this.nodesPassedWhenUsed = nodes;
      }

      handleChange(event: MouseEvent) {
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

      myForm1 = this.id('myForm1') as SubComponent;
      myForm2 = this.id('myForm2') as SubComponent;
      myForm2Child = this.id('myForm2Child') as HTMLParagraphElement;
    }
    const app = new App();
    expect(app.element).toBeInstanceOf(HTMLElement);
    expect(app.myForm1).toBeInstanceOf(TComponent);
    expect(app.myForm2).toBeInstanceOf(TComponent);
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
    expect(TComponent.from(element)).toBeUndefined();
  });
  test('Extended components are taken from their respective classes', () => {
    class A extends TComponent {
    }
    class B extends A {
    }
    const a = new A();
    const b = new B();
    expect(TComponent.from(a.element)).toBeUndefined();
    expect(TComponent.from(b.element)).toBeUndefined();
    expect(A.from(a.element)).toBe(a);
    expect(A.from(b.element)).toBeUndefined();
    expect(B.from(a.element)).toBeUndefined();
    expect(B.from(b.element)).toBe(b);
  });
  test('Elements are shared by extended components', () => {
    class A extends TComponent {
      static template = '<span></span>';
    }
    class B extends TComponent {
      static uses = { A };
      static template = '<A id="a" />';
      a = this.id('a') as A;
    }
    const b = new B();
    expect(b.element).toBe(b.a.element);
    expect(A.from(b.element)).toBe(b.a);
    expect(B.from(b.element)).toBe(b);
  });
});
