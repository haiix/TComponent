import { TComponent, applyParams } from '../../dist/index.js';

interface IDs {
  input: HTMLInputElement;
}

class Typed extends TComponent<HTMLDivElement, IDs> {
  static template = '<div><input id="input"></div>';
}

class Derived extends Typed {
  derived = true;
}

class DefaultIDs extends TComponent<HTMLDivElement> {}

const component = new Typed();
applyParams(component, component.element);
applyParams(component, component.getById('input'), {
  attributes: { class: 'forwarded' },
  childNodes: [],
});

const recovered = Typed.from(component.element);
recovered?.getById('input').value;

// Unknown IDs and incorrect element types must remain errors after recovery.
// @ts-expect-error Only IDs declared in the strict IDMap are accepted.
recovered?.getById('missing');
// @ts-expect-error The input remains HTMLInputElement, not HTMLSelectElement.
const wrongElement: HTMLSelectElement | undefined = recovered?.getById('input');
void wrongElement;

const derived = Derived.from(new Derived().element);
const defaultIDs = DefaultIDs.from(new DefaultIDs().element);
const base = TComponent.from(component.element);
base?.getById('input', HTMLInputElement).value;
const nullResult = Typed.from(null);
const undefinedResult = Typed.from(undefined);

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Assert<T extends true> = T;

export type RecoveryChecks = [
  Assert<Equal<typeof recovered, Typed | undefined>>,
  Assert<Equal<typeof derived, Derived | undefined>>,
  Assert<Equal<typeof defaultIDs, DefaultIDs | undefined>>,
  Assert<Equal<typeof base, TComponent | undefined>>,
  Assert<Equal<typeof nullResult, Typed | undefined>>,
  Assert<Equal<typeof undefinedResult, Typed | undefined>>,
];
