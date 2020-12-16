/*
 * TComponent.js
 *
 * Copyright (c) 2020 haiix
 *
 * This module is released under the MIT license.
 * see https://opensource.org/licenses/MIT
 */

const VERSION = '0.2.2-pre'

class Parser {
  constructor () {
    this.init('')
  }

  init (src) {
    this.src = src
    this.p = 0
  }

  adv (n) {
    this.p += n
  }

  isDone () {
    return this.p >= this.src.length
  }

  c () {
    return this.src[this.p]
  }

  isMatch (s) {
    return this.src.startsWith(s, this.p)
  }

  getSpace () {
    let s = ''
    while (!this.isDone()) {
      const c = this.c()
      if (c !== ' ' && c !== '\n' && c !== '\t') break
      s += c
      this.adv(1)
    }
    return s
  }

  getWord () {
    let s = ''
    while (!this.isDone()) {
      const c = this.c()
      const i = c.charCodeAt()
      if (
        // a-z
        (i < 97 || i > 122) &&
        // -
        (i !== 45) &&
        // _
        (i !== 95) &&
        // A-Z
        (i < 65 || i > 90) &&
        // 0-9
        (i < 48 || i > 57) &&
        // Non-ASCII
        (i < 128)
      ) break
      s += c
      this.adv(1)
    }
    return s
  }

  getTill (s) {
    let i = this.src.indexOf(s, this.p)
    i = i < 0 ? this.src.length : i
    const d = this.src.slice(this.p, i)
    this.p = i
    return d
  }

  ignoreTill (s) {
    const i = this.src.indexOf(s, this.p)
    if (i < 0) throw new SyntaxError('Unexpected end of input')
    this.p = i + s.length
  }

  parseTags () {
    const nodes = []
    while (!this.isMatch('</')) {
      if (this.isMatch('<!--')) {
        this.ignoreTill('-->')
      } else if (this.c() === '<') {
        nodes.push(this.parseTag())
      } else {
        const s = this.getSpace()
        if (this.c() !== '<') {
          nodes.push(s + this.getTill('<'))
        }
      }
    }
    return nodes
  }

  parseTag () {
    this.adv(1)
    const node = {}
    node.t = this.getWord()
    if (node.t === '') throw new SyntaxError('No tag name')
    node.a = this.parseAttrs()
    if (this.c() === '>') {
      this.adv(1)
      node.c = this.parseTags()
      this.adv(2)
      if (this.getWord() !== node.t) throw new SyntaxError('Start and end tag name do not match')
      this.getSpace()
      if (this.c() !== '>') throw new SyntaxError('Tag is not closed')
      this.adv(1)
    } else if (this.isMatch('/>')) {
      node.c = []
      this.adv(2)
    } else {
      throw new SyntaxError('Tag is not closed')
    }
    return node
  }

  parseAttrs () {
    const attrs = {}
    while (true) {
      this.getSpace()
      const attrName = this.getWord()
      if (attrName === '') break
      let attrValue
      if (this.c() === '=') {
        this.adv(1)
        const p = this.c()
        if (p !== '"' && p !== "'") throw new SyntaxError('Attribute value does not start with " or \'')
        this.adv(1)
        attrValue = this.getTill(p)
        this.adv(1)
      } else {
        attrValue = attrName
      }
      attrs[attrName] = attrValue
    }
    return attrs
  }

  parse (src) {
    this.init(src + '</')
    const nodes = this.parseTags()
    if (this.p !== this.src.length - 2) throw new SyntaxError('Unexpected end tag')
    if (nodes.length !== 1) throw new Error('Create only one root element in your template')
    this.init('')
    return nodes[0]
  }
}

const instanceMap = new WeakMap()

/**
 * TComponent class.
 */
class TComponent {
  /**
   * Parse a template string.
   * @param {string} template - A template string.
   * @return {Object} Parsed object.
   */
  static parse (template) {
    const parser = new Parser()
    return parser.parse(template)
  }

  /**
   * Build a html element from a parsed object.
   * @param {Object} node - A Parsed object.
   * @param {Object} [thisObj] - The object for which IDs and events are bound.
   * @param {Object} [SubComponents] - Components used in this process.
   * @return {HTMLElement} A built element.
   */
  static build (node, thisObj = null, SubComponents = Object.create(null)) {
    if (typeof node === 'string') {
      return document.createTextNode(node)
    } else if (SubComponents[node.t]) {
      const attrs = {}
      for (const [key, value] of Object.entries(node.a)) {
        if (thisObj && key.slice(0, 2) === 'on') {
          attrs[key] = new Function('event', value).bind(thisObj)
        } else if (thisObj && key !== 'id') {
          attrs[key] = value
        }
      }
      const elems = node.c.map(node => TComponent.build(node, thisObj, SubComponents))
      const subComponent = new SubComponents[node.t](attrs, elems)
      if (thisObj && node.a && node.a.id) {
        thisObj[node.a.id] = subComponent
      }
      return subComponent.element
    } else {
      const elem = document.createElement(node.t)
      for (const [key, value] of Object.entries(node.a)) {
        if (thisObj && key === 'id') {
          thisObj[value] = elem
        } else if (thisObj && key.slice(0, 2) === 'on') {
          elem[key] = new Function('event', value).bind(thisObj)
        } else {
          elem.setAttribute(key, value)
        }
      }
      for (const childNode of node.c) {
        elem.appendChild(TComponent.build(childNode, thisObj, SubComponents))
      }
      return elem
    }
  }

  /**
   * Build a TComponent instance from a template string.
   * @param {string} template - A template string.
   * @param {Object} [thisObj] - The object for which IDs and events are bound.
   * @param {Object} [SubComponents] - Components used in this process.
   * @return {TComponent} A built TComponent instance.
   */
  static create (template, thisObj = {}, SubComponents) {
    TComponent.createElement(template, thisObj, SubComponents)
    return thisObj
  }

  /**
   * Build a html element from a template string.
   * @param {string} template - A template string.
   * @param {Object} [thisObj] - The object for which IDs and events are bound.
   * @param {Object} [SubComponents] - Components used in this process.
   * @return {HTMLElement} A built html element.
   */
  static createElement (template, thisObj, SubComponents) {
    const element = TComponent.build(TComponent.parse(template), thisObj, SubComponents)
    TComponent.bindElement(thisObj, element)
    return element
  }

  /**
   * Bind a TComponent instance and a html element.
   * @param {TComponent} thisObj - A TComponent instance.
   * @param {HTMLElement} element - A html element.
   */
  static bindElement (thisObj, element) {
    if (thisObj == null || thisObj.element != null) return
    thisObj.element = element
    instanceMap.set(element, thisObj)
  }

  /**
   * Get a built TComponent instance from a element.
   * @param {HTMLElement} element - A html element of target instance.
   * @return {TComponent} a TComponent instance.
   */
  static from (element) {
    return instanceMap.get(element)
  }

  /**
   * Combert a camel case string to a kebab case.
   * @param {string} str - camel case string.
   * @return {string} kebab case string.
   */
  static camelToKebab (str) {
    return str.replace(/(\w)([A-Z])/g, '$1-$2').toLowerCase()
  }

  /**
   * Create a TComponent instance.
   */
  constructor () {
    if (!Object.prototype.hasOwnProperty.call(this.constructor, '_parsedTemplate')) {
      this.constructor._parsedTemplate = TComponent.parse(this.template())
    }
    const element = TComponent.build(this.constructor._parsedTemplate, this, this.constructor._SubComponents)
    TComponent.bindElement(this, element)
  }

  /**
   * Return a template string for this component.
   * This method must be overridden by a subclass.
   * @throw {Error}
   */
  template () {
    throw new Error('Please override "template()" method in the class extends TComponent')
  }

  /**
   * Add components used in this component.
   * @param {TComponent} SubComponent
   */
  uses (...SubComponents) {
    if (!Object.prototype.hasOwnProperty.call(this.constructor, '_SubComponents')) {
      this.constructor._SubComponents = Object.create(null)
    }
    const _SubComponents = this.constructor._SubComponents
    for (const SubComponent of SubComponents) {
      _SubComponents[SubComponent.name] = SubComponent
      _SubComponents[TComponent.camelToKebab(SubComponent.name)] = SubComponent
    }
  }
}
TComponent.version = VERSION
export default TComponent
