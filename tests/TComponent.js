// https://mochajs.org/
// https://www.chaijs.com/

import TComponent from '../TComponent.js';
const expect = chai.expect;

describe('TComponent.parse()', () => {
  it('Tag name', () => {
    const nodes = TComponent.parse('<p></p>');
    expect(nodes).to.be.an('array').with.lengthOf(1);
    expect(nodes[0]).to.be.an('object');
    expect(nodes[0]).to.have.property('tagName').that.equal('p');
  });
  it('Omitted tag name', () => {
    const nodes = TComponent.parse('<input />');
    expect(nodes).to.be.an('array').with.lengthOf(1);
    expect(nodes[0]).to.be.an('object');
    expect(nodes[0]).to.have.property('tagName').that.equal('input');
  });
  it('Multiple tags', () => {
    const nodes = TComponent.parse('<span></span><input />');
    expect(nodes).to.be.an('array').with.lengthOf(2);
    expect(nodes[0]).to.have.property('tagName').that.equal('span');
    expect(nodes[1]).to.have.property('tagName').that.equal('input');
  });
  it('Attributes', () => {
    const nodes = TComponent.parse('<p foo="bar"></p>');
    expect(nodes[0]).to.have.property('attributes').that.is.an('object');
    expect(nodes[0].attributes).to.have.property('foo').that.equal('bar');
  });
  it('Text content', () => {
    const nodes = TComponent.parse('<p>hello</p>');
    expect(nodes[0]).to.have.property('textContent').that.equal('hello');
  });
  it('Child nodes', () => {
    const nodes = TComponent.parse(`
      <ul>
        <li>item1</li>
        <li><a href="#">item2</a></li>
      </ul>
    `);
    expect(nodes).to.be.an('array').with.lengthOf(1);
    expect(nodes[0]).to.have.property('childNodes').that.is.an('array').with.lengthOf(2);
    expect(nodes[0].childNodes[0]).to.have.property('tagName').that.equal('li');
    expect(nodes[0].childNodes[0]).to.have.property('textContent').that.equal('item1');
    expect(nodes[0].childNodes[1]).to.have.property('tagName').that.equal('li');
    expect(nodes[0].childNodes[1]).to.have.property('childNodes').that.is.an('array').with.lengthOf(1);
  });
  it('Comments', () => {
    const nodes = TComponent.parse(`
      <!-- Some comment -->
      <header>
        <!-- Another comment -->
        <h1>Hello</h1>
      </header>
      <!-- More comment -->
      <section>
      </section>
    `);
    expect(nodes).to.be.an('array').with.lengthOf(2);
    expect(nodes[0]).to.have.property('childNodes').that.is.an('array').with.lengthOf(1);
  });
  it('Errors', () => {
    expect(() => { TComponent.parse('<!-- Unexpected end of input'); }).throw(Error);
    expect(() => { TComponent.parse('Tag is not started'); }).throw(Error);
    expect(() => { TComponent.parse('<>No tag name< />'); }).throw(Error);
    expect(() => { TComponent.parse('<a><b>Unexpected end of input</b>'); }).throw(Error);
    expect(() => { TComponent.parse('<p>Start and end tag name do not match</q>'); }).throw(Error);
    expect(() => { TComponent.parse('<Tag></Tag is not closed>'); }).throw(Error);
    expect(() => { TComponent.parse('<a <The start tag is not closed'); }).throw(Error);
    expect(() => { TComponent.parse('<p a=1>Attribute value does not start with "</p>'); }).throw(Error);
  });
});