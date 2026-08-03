import { describe, it, expect } from 'vitest';
import {
  isSafeTagName,
  isSafeUrl,
  isSafeSrcset,
  isSafeAttributeValue,
} from '../../src/internal/dom-validator';

describe('dom-validator', () => {
  describe('isSafeTagName', () => {
    it('should return true for valid and safe tag names', () => {
      expect(isSafeTagName('div')).toBe(true);
      expect(isSafeTagName('span')).toBe(true);
      expect(isSafeTagName('h1')).toBe(true);
      expect(isSafeTagName('custom-element')).toBe(true);
    });

    it('should handle case insensitivity correctly', () => {
      expect(isSafeTagName('DIV')).toBe(true);
      expect(isSafeTagName('Custom-Element')).toBe(true);
    });

    it('should return false for invalid tag name formats', () => {
      expect(isSafeTagName('1div')).toBe(false); // Cannot start with a number
      expect(isSafeTagName('-span')).toBe(false); // Cannot start with a hyphen
      expect(isSafeTagName('div!')).toBe(false); // Invalid character
      expect(isSafeTagName(' ')).toBe(false);
      expect(isSafeTagName('')).toBe(false);
    });

    it('should return false for forbidden tag names', () => {
      expect(isSafeTagName('script')).toBe(false);
      expect(isSafeTagName('iframe')).toBe(false);
      expect(isSafeTagName('object')).toBe(false);
      expect(isSafeTagName('style')).toBe(false);
      // Case insensitive check for forbidden tags
      expect(isSafeTagName('SCRIPT')).toBe(false);
    });
  });

  describe('isSafeUrl', () => {
    it('should return true for allowed schemes', () => {
      expect(isSafeUrl('http://example.com')).toBe(true);
      expect(isSafeUrl('https://example.com/path')).toBe(true);
      expect(isSafeUrl('mailto:test@example.com')).toBe(true);
      expect(isSafeUrl('tel:+1234567890')).toBe(true);
    });

    it('should return true for relative URLs', () => {
      // Relative URLs will resolve to 'https://localhost/...' using the base URL
      expect(isSafeUrl('/path/to/resource')).toBe(true);
      expect(isSafeUrl('relative/path')).toBe(true);
      expect(isSafeUrl('?query=1')).toBe(true);
      expect(isSafeUrl('#fragment')).toBe(true);
    });

    it('should return true for empty or whitespace-only strings', () => {
      expect(isSafeUrl('')).toBe(true);
      expect(isSafeUrl('   ')).toBe(true);
    });

    it('should return false for forbidden schemes', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
      expect(isSafeUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
      expect(isSafeUrl('file:///etc/passwd')).toBe(false);
      expect(isSafeUrl('ws://example.com')).toBe(false); // 'ws:' is not in ALLOWED_SCHEMES
    });

    it('should handle leading/trailing whitespaces properly', () => {
      expect(isSafeUrl('  https://example.com  ')).toBe(true);
      expect(isSafeUrl('\n javascript:alert(1) \t')).toBe(false);
    });
  });

  describe('isSafeSrcset', () => {
    it('should return true for valid srcset values', () => {
      expect(isSafeSrcset('image-320w.jpg 320w, image-480w.jpg 480w')).toBe(
        true,
      );
      expect(isSafeSrcset('https://example.com/img.png 1x, /img.png 2x')).toBe(
        true,
      );
    });

    it('should return true for empty values', () => {
      expect(isSafeSrcset('')).toBe(true);
      expect(isSafeSrcset('   ')).toBe(true);
    });

    it('should return false if any URL in the srcset is unsafe', () => {
      expect(isSafeSrcset('javascript:alert(1) 1x')).toBe(false);
      expect(isSafeSrcset('image.jpg 1x, javascript:alert(1) 2x')).toBe(false);
      expect(isSafeSrcset('data:image/png;base64,123 320w')).toBe(false); // data: is not allowed
    });
  });

  describe('isSafeAttributeValue', () => {
    it('should return false for event handler attributes', () => {
      expect(isSafeAttributeValue('onclick', 'alert(1)')).toBe(false);
      expect(isSafeAttributeValue('onmouseover', 'console.log(1)')).toBe(false);
      // Case insensitive check
      expect(isSafeAttributeValue('ONLOAD', 'init()')).toBe(false);
    });

    it('should return false for blocked attributes', () => {
      expect(isSafeAttributeValue('srcdoc', '<html><body></body></html>')).toBe(
        false,
      );
      expect(isSafeAttributeValue('SRCDOC', '<html></html>')).toBe(false);
    });

    it('should validate srcset attributes using isSafeSrcset', () => {
      expect(isSafeAttributeValue('srcset', '/img.png 1x')).toBe(true);
      expect(isSafeAttributeValue('srcset', 'javascript:alert(1) 1x')).toBe(
        false,
      );
    });

    it('should validate URL attributes using isSafeUrl', () => {
      // Safe URLs
      expect(isSafeAttributeValue('href', 'https://example.com')).toBe(true);
      expect(isSafeAttributeValue('src', '/image.png')).toBe(true);
      expect(isSafeAttributeValue('action', '/submit')).toBe(true);

      // Unsafe URLs
      expect(isSafeAttributeValue('href', 'javascript:alert(1)')).toBe(false);
      expect(isSafeAttributeValue('xlink:href', 'javascript:alert(1)')).toBe(
        false,
      );
      expect(isSafeAttributeValue('formaction', 'data:text/html,...')).toBe(
        false,
      );
    });

    it('should return true for other generic attributes regardless of value', () => {
      // For attributes like 'class', 'id', 'data-*', 'javascript:...' is just a string, not executable
      expect(isSafeAttributeValue('class', 'javascript:alert(1)')).toBe(true);
      expect(isSafeAttributeValue('id', 'my-id')).toBe(true);
      expect(isSafeAttributeValue('data-custom', 'any-value')).toBe(true);
      expect(isSafeAttributeValue('aria-label', 'Button')).toBe(true);
    });
  });
});
