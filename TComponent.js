const VERSION = '0.1.5';

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
      curr.attributes = curr.attributes || {};
      if (this.match('=')) {
        this.next();
        if (!this.match('"')) throw new Error('Syntax error: Attribute value does not start with "');
        this.next();
        curr.attributes[attrKey] = this.getUntil('"');
        this.next();
      } else {
        curr.attributes[attrKey] = attrKey;
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
  static parse(template) {
    const parser = new Parser();
    return parser.parse(template);
  }
  static build(node, thisObj = null, SubComponents = Object.create(null)) {
    const SubComponent = SubComponents[node.tagName];
    if (SubComponent) {
      const inner = node.childNodes ? node.childNodes.map(node => TComponent.build(node, thisObj, SubComponents)) : node.textContent;
      const attrs = {};
      if (node.attributes) {
        for (const [key, value] of Object.entries(node.attributes)) {
          if (thisObj && key.slice(0, 2) === 'on') {
            attrs[key] = new Function('event', value).bind(thisObj);
          } else if (thisObj && key !== 'id') {
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
          elem.appendChild(TComponent.build(childNode, thisObj, SubComponents));
        }
      }
      return elem;
    }
  }
  static create(template, thisObj = {}) {
    TComponent.createElement(template, thisObj);
    return thisObj;
  }
  static createElement(template, thisObj, SubComponents) {
    const nodes = TComponent.parse(template);
    if (nodes.length !== 1) throw new Error('Create only one root element in your template');
    const element = TComponent.build(nodes[0], thisObj, SubComponents);
    if (thisObj != null) {
      thisObj.element = element;
      TComponent._instanceMap.set(element, thisObj);
    }
    return element;
  }
  static from(element) {
    return TComponent._instanceMap.get(element);
  }
  static camelToKebab(str) {
    return str.replace(/(\w)([A-Z])/g, '$1-$2').toLowerCase();
  }
  constructor() {
    if (!this.constructor.hasOwnProperty('_parsedTemplate')) {
      const nodes = TComponent.parse(this.template());
      if (nodes.length !== 1) throw new Error('Create only one root element in your template');
      this.constructor._parsedTemplate = nodes[0];
    }
    this.element = TComponent.build(this.constructor._parsedTemplate, this, this.constructor._SubComponents);
    TComponent._instanceMap.set(this.element, this);
  }
  template() {
    throw new Error('Please override "template()" method in the class extends TComponent');
  }
  uses(...SubComponents) {
    if (!this.constructor.hasOwnProperty('_SubComponents')) {
      this.constructor._SubComponents = Object.create(null);
    }
    const _SubComponents = this.constructor._SubComponents;
    for (const SubComponent of SubComponents) {
      _SubComponents[SubComponent.name] = SubComponent;
      _SubComponents[TComponent.camelToKebab(SubComponent.name)] = SubComponent;
    }
  }
}
TComponent.version = VERSION;
TComponent._SubComponents = Object.create(null);
TComponent._instanceMap = new WeakMap();