const VERSION = '0.1.3';

class Parser {
  // phase 0
  constructor() {
    this.init();
  }
  init(src = '') {
    this.src = src;
    this.cursor = 0;
  }
  // phase 1
  next(n = 1) {
    this.cursor += n;
  }
  c() {
    return this.src[this.cursor];
  }
  isDone() {
    return this.src.length <= this.cursor;
  }
  // phase 2
  match(q) {
    return this.src.slice(this.cursor, this.cursor + q.length) === q;
  }
  getSpace() {
    let s = '';
    while (!this.isDone()) {
      const c = this.c();
      if (c !== ' ' && c !== '\n' && c !== '\t') break;
      s += c;
      this.next();
    }
    return s;
  }
  getWord() {
    let s = '';
    while (!this.isDone()) {
      const c = this.c();
      const i = c.charCodeAt();
      if (
        i != 45 &&                      // -
        (i < 48 || 57 < i) &&           // 0-9
        (i < 65 || 90 < i) &&           // A-Z
        i != 95 &&                      // _
        (i < 97 || 122 < i)             // a-z
      ) break;
      s += c;
      this.next();
    }
    return s;
  }
  getUntil(q) {
    let s = '';
    while (!this.match(q)) {
      if (this.isDone()) throw new Error('Syntax error: Unexpected end of input');
      s += this.c();
      this.next();
    }
    return s;
  }
  // phase 3
  parseTag() {
    const curr = {};
    while (this.match('<!--')) {                            // comment
      this.getUntil('-->');
      this.next(3);
      this.getSpace();
    }
    if (!this.match('<')) throw new Error('Syntax error: Tag is not started');
    this.next();
    curr.tagName = this.getWord();
    if (!curr.tagName) throw new Error('Syntax error: No tag name');
    this.parseAttrs(curr);
    if (this.match('/>')) {                                 // <tagName/>
      this.next(2);
    } else if (this.match('>')) {                           // inner tag
      this.next();
      let value = this.getSpace();
      if (!this.match('<')) {                               // plain text
        curr.attributes = curr.attributes || {};
        curr.textContent = value + this.getUntil('</');
      } else if (!this.match('</')) {                       // child elements
        curr.childNodes = [];
        while (!this.match('</')) {
          if (this.isDone()) throw new Error('Syntax error: Unexpected end of input');
          curr.childNodes.push(this.parseTag());
          this.getSpace();
        }
      }
      this.next(2);
      if (this.getWord() !== curr.tagName) throw new Error('Syntax error: Start and end tag name do not match');
      if (!this.match('>')) throw new Error('Syntax error: Tag is not closed');
      this.next();
    } else {
      throw new Error('Syntax error: The start tag is not closed with ">"');
    }
    return curr;
  }
  parseAttrs(curr) {
    while (true) {
      this.getSpace();
      const attrKey = this.getWord();
      if (attrKey === '') break;
      if (this.match('=')) {
        this.next();
        if (!this.match('"')) throw new Error('Syntax error: Attribute value does not start with "');
        this.next();
        curr.attributes = curr.attributes || {};
        curr.attributes[attrKey] = this.getUntil('"');
        this.next();
      } else {
        throw new Error('Not impremented: Attribute has no value');
      }
    }
  }
  // phase 4
  parse(src) {
    this.init(src);
    const nodes = [];
    this.getSpace();
    while (!this.isDone()) {
      nodes.push(this.parseTag());
      this.getSpace();
    }
    this.init();
    return nodes;
  }
}

export default class TComponent {
  static define(tagName, SubComponent) {
    TComponent.definedComponents[tagName] = SubComponent;
  }
  static parse(template) {
    const parser = new Parser();
    return parser.parse(template);
  }
  static build(node, thisObj = null) {
    const SubComponent = TComponent.definedComponents[node.tagName];
    if (SubComponent) {
      const inner = node.childNodes ? node.childNodes.map(node => TComponent.build(node, thisObj)) : node.textContent;
      const attrs = {};
      if (node.attributes) {
        for (const [key, value] of Object.entries(node.attributes)) {
          if (thisObj && key.slice(0, 2) === 'on') {
            attrs[key] = new Function('event', value).bind(thisObj);
          } else {
            attrs[key] = value;
          }
        }
      }
      const subComponent = new SubComponent(attrs, inner);
      if (thisObj && node.attributes && node.attributes.id) {
        thisObj[node.attributes.id] = subComponent;
      }
      return subComponent.element;
    } else {
      const elem = document.createElement(node.tagName);
      if (node.attributes) {
        for (const [key, value] of Object.entries(node.attributes)) {
          if (thisObj && key === 'id') {
            thisObj[value] = elem;
          } else if (thisObj && key.slice(0, 2) === 'on') {
            elem[key] = new Function('event', value).bind(thisObj);
          } else {
            elem.setAttribute(key, value);
          }
        }
      }
      if (node.textContent) {
        elem.textContent = node.textContent;
      }
      if (node.childNodes) {
        for (const childNode of node.childNodes) {
          elem.appendChild(TComponent.build(childNode, thisObj));
        }
      }
      return elem;
    }
  }
  static create(template, thisObj = {}) {
    TComponent.createElement(template, thisObj);
    return thisObj;
  }
  static createElement(template, thisObj) {
    const nodes = TComponent.parse(template);
    if (nodes.length !== 1) throw new Error('Create only one root element in your template');
    const element = TComponent.build(nodes[0], thisObj);
    if (thisObj != null) {
      thisObj.element = element;
      TComponent.instanceMap.set(element, thisObj);
    }
    return element;
  }
  static from(element) {
    return TComponent.instanceMap.get(element) || new TComponent(element);
  }
  template() {
    throw new Error('Please override "template()" method in the class extends TComponent');
  }
  constructor(element) {
    if (element != null && element instanceof HTMLElement) {
      this.element = element;
    } else {
      if (!this.constructor.parsedTemplate) {
        const nodes = TComponent.parse(this.template());
        if (nodes.length !== 1) throw new Error('Create only one root element in your template');
        this.constructor.parsedTemplate = nodes[0];
      }
      this.element = TComponent.build(this.constructor.parsedTemplate, this);
    }
    TComponent.instanceMap.set(this.element, this);
  }
}
TComponent.version = VERSION;
TComponent.definedComponents = Object.create(null);
TComponent.instanceMap = new WeakMap();