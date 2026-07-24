import type { TComponent } from '../TComponent';
import type { TNode } from '../types';

/**
 * Appends parsed child nodes (slots) to a target DOM element.
 * It builds the nodes using the specified context component to ensure
 * events and custom components resolve correctly within the slot scope.
 *
 * @param contextComponent - The component instance providing the build context.
 * @param target - The DOM element to append the child nodes to.
 * @param childNodes - The AST nodes or strings to append.
 */
export function appendSlots(
  contextComponent: TComponent,
  target: Element,
  childNodes: (TNode | string)[],
): void {
  if (!childNodes.length) return;

  contextComponent.context.appendChildren(target, childNodes);
}
