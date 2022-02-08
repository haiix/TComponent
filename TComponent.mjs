/*
 * TComponent.mjs
 *
 * Copyright (c) 2020 haiix
 *
 * This module is released under the MIT license:
 * https://opensource.org/licenses/MIT
 */

const VERSION = '0.2.6beta'

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
      } else if (this.isMatch('<![CDATA[')) {
        this.adv(9)
        nodes.push(this.getTill(']]>'))
        this.adv(3)
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

function hasOwnProperty (obj, name) {
  return Object.prototype.hasOwnProperty.call(obj, name)
}

function dispatchError (error, thisObj) {
  if (thisObj != null && typeof thisObj.onerror === 'function') {
    thisObj.onerror(error)
  } else {
    throw error
  }
}

function createEventFunc (code, thisObj) {
  const func = new Function('event', code).bind(thisObj)
  return event => {
    try {
      const ret = func(event)
      if (ret != null && typeof ret.catch === 'function') {
        return ret.catch(error => dispatchError(error, thisObj))
      }
      return ret
    } catch (error) {
      dispatchError(error, thisObj)
    }
  }
}

function parseTemplate (ExtendedTComponent) {
  if (hasOwnProperty(ExtendedTComponent, '_parsedTemplate')) return
  const template = ExtendedTComponent.prototype.template()
  if (template == null) return
  ExtendedTComponent._parsedTemplate = TComponent.parse(template)
}

const instanceMap = new WeakMap()

/**
 * TComponent class.
 */
class TComponent {
  /**
   * Parse a template string. The parsed object can be converted to JSON.
   * @param {string} template - The template string to parse.
   * @return {Object} The parsed object.
   */
  static parse (template) {
    const parser = new Parser()
    return parser.parse(template)
  }

  /**
   * Build a html element from a parsed object.
   * @param {Object} node - The object parsed by the TComponent.parse() method.
   * @param {Object} [thisObj] - The object that binds IDs and events.
   * @param {Object} [SubComponents] - Components to use in this process.
   * @return {HTMLElement} The built element.
   */
  static build (node, thisObj = null, SubComponents = Object.create(null)) {
    if (typeof node === 'string') {
      return document.createTextNode(node)
    } else if (SubComponents[node.t]) {
      const attrs = {}
      for (const [key, value] of Object.entries(node.a)) {
        if (thisObj && key.slice(0, 2) === 'on') {
          attrs[key] = createEventFunc(value, thisObj)
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
          elem[key] = createEventFunc(value, thisObj)
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
   * @param {string} template - The template string.
   * @param {Object} [thisObj] - The object that binds IDs and events.
   * @param {Object} [SubComponents] - Components to use in this process.
   * @return {TComponent} The built TComponent instance.
   */
  static create (template, thisObj = {}, SubComponents) {
    TComponent.createElement(template, thisObj, SubComponents)
    return thisObj
  }

  /**
   * Build a html element from a template string.
   * @param {string} template - The template string.
   * @param {Object} [thisObj] - The object that binds IDs and events.
   * @param {Object} [SubComponents] - Components to use in this process.
   * @return {HTMLElement} The built html element.
   */
  static createElement (template, thisObj, SubComponents) {
    const element = TComponent.build(TComponent.parse(template), thisObj, SubComponents)
    TComponent.bindElement(thisObj, element)
    return element
  }

  /**
   * Bind a TComponent instance and a html element. The bound element can be retrieved using the TComponent.from() method.
   * @param {TComponent} thisObj - The TComponent instance.
   * @param {HTMLElement} element - The html element.
   */
  static bindElement (thisObj, element) {
    if (thisObj == null || thisObj.element != null) return
    thisObj.element = element
    instanceMap.set(element, thisObj)
  }

  /**
   * Get a TComponent instance from a bound element.
   * @param {HTMLElement} element - The html element of the target TComponent instance.
   * @return {TComponent} The TComponent instance.
   */
  static from (element) {
    return instanceMap.get(element)
  }

  /**
   * Combert a camel case string to a kebab case.
   * @param {string} str - The camel case string.
   * @return {string} The kebab case string.
   */
  static camelToKebab (str) {
    return (str.slice(0, 1) + str.slice(1).replace(/([A-Z])/g, '-$1')).toLowerCase()
  }

  /**
   * Create a TComponent instance.
   * The constructor can be overridden by subclasses.
   * @param {object} attributes - The attributes that built in the parent component.
   * @param {array} elements - The array of html elements that built in the parent component.
   */
  constructor () {
    parseTemplate(this.constructor)
    if (this.constructor._parsedTemplate != null) {
      const element = TComponent.build(this.constructor._parsedTemplate, this, this.constructor._SubComponents)
      TComponent.bindElement(this, element)
    }
  }

  /**
   * Return a template string for this component.
   * This method must be overridden by subclasses.
   * @throw {Error}
   */
  template () {
    throw new Error('Please override "template()" method in the class extends TComponent')
  }

  /**
   * Add components to use in this component.
   * @param {...TComponent} SubComponents
   */
  uses (...SubComponents) {
    if (!hasOwnProperty(this.constructor, '_SubComponents')) {
      this.constructor._SubComponents = Object.create(null)
    }
    const _SubComponents = this.constructor._SubComponents
    for (const SubComponent of SubComponents) {
      parseTemplate(SubComponent)
      if (!hasOwnProperty(SubComponent.prototype, 'tagName')) {
        SubComponent.prototype.tagName = SubComponent.name
      }
      _SubComponents[SubComponent.prototype.tagName] = SubComponent
      _SubComponents[TComponent.camelToKebab(SubComponent.prototype.tagName)] = SubComponent
    }
  }
}
TComponent.version = VERSION
export default TComponent
