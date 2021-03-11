/* global describe, it, chai */

// https://mochajs.org/
// https://www.chaijs.com/

import TComponent from '../TComponent.mjs'
const expect = chai.expect

describe('TComponent.parse()', () => {
  it('Tag name', () => {
    const node = TComponent.parse('<p></p>')
    expect(node).to.be.an('object')
    expect(node).to.have.property('t').that.equal('p')
  })
  it('Omitted tag name', () => {
    const node = TComponent.parse('<input />')
    expect(node).to.be.an('object')
    expect(node).to.have.property('t').that.equal('input')
  })
  it('Attributes', () => {
    const node = TComponent.parse('<p foo="bar"></p>')
    expect(node).to.have.property('a').that.is.an('object')
    expect(node.a).to.have.property('foo').that.equal('bar')
  })
  it('Single quote attributes', () => {
    const node = TComponent.parse("<p foo='bar'></p>")
    expect(node).to.have.property('a').that.is.an('object')
    expect(node.a).to.have.property('foo').that.equal('bar')
  })
  it('Omitted attributes', () => {
    const node = TComponent.parse('<p foo></p>')
    expect(node).to.have.property('a').that.is.an('object')
    expect(node.a).to.have.property('foo').that.equal('foo')
  })
  it('Allow space on the end tag', () => {
    const node = TComponent.parse('<p></p \t>')
    expect(node).to.be.an('object')
    expect(node).to.have.property('t').that.equal('p')
  })
  it('Child nodes', () => {
    const node = TComponent.parse(`
      <ul>
        <li>item1</li>
        <li><a href="#">item2</a></li>
      </ul>
    `)
    expect(node).to.have.property('c').that.is.an('array').with.lengthOf(2)
    expect(node.c[0]).to.have.property('t').that.equal('li')
    expect(node.c[1]).to.have.property('t').that.equal('li')
    expect(node.c[1]).to.have.property('c').that.is.an('array').with.lengthOf(1)
  })
  it('Text content', () => {
    const node = TComponent.parse('<p>hello</p>')
    expect(node).to.have.property('c').that.is.an('array').with.lengthOf(1)
    expect(node.c[0]).to.be.a('string').that.equal('hello')
  })
  it('CDATA', () => {
    const node = TComponent.parse('<p> <![CDATA[ <i> hello </i> ]]> </p>')
    expect(node).to.have.property('c').that.is.an('array').with.lengthOf(1)
    expect(node.c[0]).to.be.a('string').that.equal(' <i> hello </i> ')
  })
  it('Comments', () => {
    const node = TComponent.parse(`
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
    `)
    expect(node).to.have.property('c').that.is.an('array').with.lengthOf(2)
  })
  it('Errors', () => {
    expect(() => { TComponent.parse('<p /><p>Multi tags</p>') }).throw(Error)
    expect(() => { TComponent.parse('<!-- Unexpected end of input') }).throw(Error)
    expect(() => { TComponent.parse('<>No tag name< />') }).throw(Error)
    expect(() => { TComponent.parse('<a><b>Unexpected end of input</b>') }).throw(Error)
    expect(() => { TComponent.parse('<p>Start and end tag name do not match</q>') }).throw(Error)
    expect(() => { TComponent.parse('<Tag></Tag is not closed>') }).throw(Error)
    expect(() => { TComponent.parse('<a <The start tag is not closed') }).throw(Error)
    expect(() => { TComponent.parse('<p a=1>Attribute value does not start with "</p>') }).throw(Error)
  })
})

describe('TComponent.build()', () => {
  it('Element', () => {
    const node = TComponent.parse(`
      <label id="nameOfPet">
        <span>Please enter the name of your pet.</span>
        <input onchange="handleChange(event)" />
      </label>
    `)
    const element = TComponent.build(node)
    expect(element).to.be.a('HTMLLabelElement')
    expect(element.getAttribute('id')).to.equal('nameOfPet')
    expect(element.childElementCount).to.equal(2)
    expect(element.children[0]).to.be.a('HTMLSpanElement')
    expect(element.children[0].textContent).to.equal('Please enter the name of your pet.')
    expect(element.children[1]).to.be.a('HTMLInputElement')
    expect(element.children[1].getAttribute('onchange')).to.be.a('string')
    expect(element.children[1].onchange).to.be.a('function')
  })
  it('Component', () => {
    const node = TComponent.parse(`
      <label id="nameOfPet">
        <span>Please enter the name of your pet.</span>
        <input onchange="this.handleChange(event)" />
      </label>
    `)
    const thisObj = {
      modified: false,
      handleChange (event) {
        this.modified = true
      }
    }
    const element = TComponent.build(node, thisObj)
    expect(element).to.be.a('HTMLLabelElement')
    expect(element.getAttribute('id')).to.equal(null)
    expect(thisObj.nameOfPet).to.equal(element)
    expect(element.childElementCount).to.equal(2)
    expect(element.children[0]).to.be.a('HTMLSpanElement')
    expect(element.children[0].textContent).to.equal('Please enter the name of your pet.')
    expect(element.children[1]).to.be.a('HTMLInputElement')
    expect(element.children[1].getAttribute('onchange')).to.equal(null)
    expect(element.children[1].onchange).to.be.a('function')

    expect(thisObj.modified).to.equal(false)
    element.children[1].onchange()
    expect(thisObj.modified).to.equal(true)
  })
})

describe('Extends TComponent', () => {
  class SubComponent extends TComponent {
    template () {
      return `
        <label id="nameOfPet">
          <span>Please enter the name of your pet.</span>
          <input onchange="this.handleChange(event)" />
        </label>
      `
    }

    constructor (attrs, nodes) {
      super()
      this.modified = false

      this.attrsPassedWhenUsed = attrs
      this.nodesPassedWhenUsed = nodes
    }

    handleChange (event) {
      this.modified = true
    }
  }

  it('Extends', () => {
    expect(SubComponent._parsedTemplate).to.equal(undefined)
    const subComponent = new SubComponent()
    expect(SubComponent._parsedTemplate).to.be.an('object')
    expect(subComponent.element).to.be.a('HTMLLabelElement')
    expect(subComponent.nameOfPet).to.equal(subComponent.element)
  })

  it('Use', () => {
    class App extends TComponent {
      template () {
        this.uses(SubComponent)
        return `
          <section>
            <h1>Use sub component</h1>
            <SubComponent id="myForm1" foo="bar">some text</SubComponent>
            <sub-component id="myForm2"><p id="myForm2Child">some element</p></sub-component>
          </section>
        `
      }
    }
    const app = new App()
    expect(app).to.have.property('element').that.is.a('HTMLElement')
    expect(app).to.have.property('myForm1').that.is.an.instanceof(TComponent)
    expect(app).to.have.property('myForm2').that.is.an.instanceof(TComponent)
    expect(app).to.have.property('myForm2Child').that.is.a('HTMLParagraphElement')
    expect(app.element.childElementCount).to.equal(3)
    expect(app.element.children[0]).to.be.a('HTMLHeadingElement')
    expect(app.element.children[1]).to.equal(app.myForm1.element)
    expect(app.myForm1.attrsPassedWhenUsed).to.deep.equal({ foo: 'bar' })
    expect(app.myForm1.nodesPassedWhenUsed[0].textContent).to.equal('some text')
    expect(app.myForm2.nodesPassedWhenUsed).to.be.an('array').with.lengthOf(1)
    expect(app.myForm2.nodesPassedWhenUsed[0]).to.equal(app.myForm2Child)
  })
})

describe('Utils', () => {
  it('camelToKebab', () => {
    const result = TComponent.camelToKebab('ParseHTML')
    expect(result).to.be.equal('parse-h-t-m-l')
  })
})
