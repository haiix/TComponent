import { TComponent } from '../TComponent';
import type { TNode } from '../types';

/**
 * Appends parsed child nodes (slots) to a target DOM element.
 * It builds the nodes using the parent component's context to ensure
 * events and custom components resolve correctly within the slot scope.
 *
 * @param component - The current component receiving the slots.
 * @param target - The DOM element to append the child nodes to.
 * @param childNodes - The AST nodes or strings to append.
 */
export function appendSlots(
  component: TComponent,
  target: Element,
  childNodes: (TNode | string)[],
): void {
  if (!childNodes.length) return;

  // Slots are evaluated in the scope of the parent component, if one exists.
  const contextComponent =
    component.parent instanceof TComponent ? component.parent : component;

  for (const child of childNodes) {
    target.appendChild(
      typeof child === 'string'
        ? document.createTextNode(child)
        : contextComponent.context.build(child),
    );
  }
}
