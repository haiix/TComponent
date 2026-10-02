import type { TNode } from '../types';

/** Recursively freezes a library-owned template AST before caching it. */
export function freezeTemplate(node: TNode): void {
  for (const child of node.c) {
    if (typeof child !== 'string') freezeTemplate(child);
  }
  Object.freeze(node.a);
  Object.freeze(node.c);
  Object.freeze(node);
}
