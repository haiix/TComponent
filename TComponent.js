const VERSION = '0.2.0';

class Parser {
  constructor() {
    this.init('');
  }
  init(src) {
    this.src = src;
    this.p = 0;
  }
  adv(n) {
    this.p += n;
  }
  isDone() {
    return this.p >= this.src.length;
  }
  c() {
    return this.src[this.p];
  }
  isMatch(s) {
    return this.src.startsWith(s, this.p);
  }
  getSpace() {
    let s = '';
    while (!this.isDone()) {
      const c = this.c();
      if (c !== ' ' && c !== '\n' && c !== '\t') break;
      s += c;
      this.adv(1);
    }
    return s;
  }
  getWord() {
    let s = '';
    while (!this.isDone()) {
      const c = this.c();
      const i = c.charCodeAt();
      if (
        (i < 97 || 122 < i) &&   // a-z
        (i !== 45) &&            // -
        (i !== 95) &&            // _
        (i < 65 || 90 < i) &&    // A-Z
        (i < 48 || 57 < i)       // 0-9
      ) break;
      s += c;
      this.adv(1);
    }
    return s;
  }
  getTill(s) {
    let i = this.src.indexOf(s, this.p);
    i = i < 0 ? this.src.length : i;
    const d = this.src.slice(this.p, i);
    this.p = i;
    return d;
  }
  ignoreTill(s) {
    const i = this.src.indexOf(s, this.p);
    if (i < 0) throw new SyntaxError('Unexpected end of input');
    this.p = i + s.length;
  }
  parseTags() {
    const nodes = [];
    while (!this.isMatch('</')) {
      if (this.isMatch('<!--')) {
        this.ignoreTill('-->');
      } else if (this.c() === '<') {
        nodes.push(this.parseTag());
      } else {
        const s = this.getSpace();
        if (this.c() !== '<') {
          nodes.push({
            t: '',
            v: s + this.getTill('<'),
          });
        }
      }
    }
    return nodes;
  }
  parseTag() {
    this.adv(1);
    const node = {};
    node.t = this.getWord();
    if (node.t === '') throw new SyntaxError('No tag name');
    node.a = this.parseAttrs();
    if (this.c() === '>') {
      this.adv(1);
      node.c = this.parseTags();
      this.adv(2);
      if (this.getWord() !== node.t) throw new SyntaxError('Start and end tag name do not match');
      if (this.c() !== '>') throw new SyntaxError('Tag is not closed');
      this.adv(1);
    } else if (this.isMatch('/>')) {
      node.c = [];
      this.adv(2);
    } else {
      throw new SyntaxError('Tag is not closed');
    }
    return node;
  }
  parseAttrs() {
    const attrs = {};
    while (true) {
      this.getSpace();
      const attrName = this.getWord();
      if (attrName === '') break;
      let attrValue;
      if (this.c() === '=') {
        this.adv(1);
        if (this.c() !== '"') throw new SyntaxError('Attribute value does not start with "');
        this.adv(1);
        attrValue = this.getTill('"');
        this.adv(1);
      } else {
        attrValue = attrName;
      }
      attrs[attrName] = attrValue;
    }
    return attrs;
  }
  parse(src) {
    this.init(src + '</');
    const nodes = this.parseTags();
    if (this.p !== this.src.length - 2) throw new SyntaxError('Unexpected end tag');
    this.init('');
    return nodes;
  }
}

export default class TComponent {
  static parse(template) {
    const parser = new Parser();
    return parser.parse(template);
  }
  static build(node, thisObj = null, SubComponents = Object.create(null)) {
    const SubComponent = SubComponents[node.t];
    if (SubComponent) {
      const inner = node.c.map(node => TComponent.build(node, thisObj, SubComponents));
      const attrs = {};
      for (const [key, value] of Object.entries(node.a)) {
        if (thisObj && key.slice(0, 2) === 'on') {
          attrs[key] = new Function('event', value).bind(thisObj);
        } else if (thisObj && key !== 'id') {
          attrs[key] = value;
        }
      }
      const subComponent = new SubComponent(attrs, inner);
      if (thisObj && node.a && node.a.id) {
        thisObj[node.a.id] = subComponent;
      }
      return subComponent.element;
    } else if (node.t === '') {
      return document.createTextNode(node.v);
    } else {
      const elem = document.createElement(node.t);
      for (const [key, value] of Object.entries(node.a)) {
        if (thisObj && key === 'id') {
          thisObj[value] = elem;
        } else if (thisObj && key.slice(0, 2) === 'on') {
          elem[key] = new Function('event', value).bind(thisObj);
        } else {
          elem.setAttribute(key, value);
        }
      }
      for (const childNode of node.c) {
        elem.appendChild(TComponent.build(childNode, thisObj, SubComponents));
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
