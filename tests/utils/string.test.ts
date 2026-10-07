import { describe, it, expect } from 'vitest';
import { kebabKeys } from '../../src/utils/string';

describe('kebabKeys utility', () => {
  it('converts PascalCase object keys to kebab-case', () => {
    const DynamicList = class {};
    const UserProfile = class {};

    const result = kebabKeys({ DynamicList, UserProfile });

    expect(result).toHaveProperty('dynamic-list', DynamicList);
    expect(result).toHaveProperty('user-profile', UserProfile);
    expect(Object.keys(result)).toEqual(['dynamic-list', 'user-profile']);
  });

  it('handles camelCase correctly', () => {
    const myComponent = class {};
    const result = kebabKeys({ myComponent });
    expect(result).toHaveProperty('my-component', myComponent);
  });

  it('handles consecutive uppercase letters (Acronyms) gracefully', () => {
    const XMLParser = class {};
    const SVGIcon = class {};

    const result = kebabKeys({ XMLParser, SVGIcon });

    expect(result).toHaveProperty('xml-parser', XMLParser);
    expect(result).toHaveProperty('svg-icon', SVGIcon);
  });

  it('handles numbers in component names', () => {
    const DynamicList2Item = class {};
    const result = kebabKeys({ DynamicList2Item });
    expect(result).toHaveProperty('dynamic-list2-item', DynamicList2Item);
  });

  it.each(['__proto__', '__PROTO__'])(
    'preserves %s as an own kebab-cased property without changing the prototype',
    (key) => {
      const component = class {};
      const input = Object.fromEntries([[key, component]]);

      const result = kebabKeys(input);

      expect(Object.hasOwn(result, '__proto__')).toBe(true);
      expect(Object.keys(result)).toEqual(['__proto__']);
      expect(Object.getOwnPropertyDescriptor(result, '__proto__')).toEqual({
        value: component,
        writable: true,
        enumerable: true,
        configurable: true,
      });
      expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
      expect(Object.getPrototypeOf(input)).toBe(Object.prototype);
      expect(Object.keys(input)).toEqual([key]);
    },
  );
});
