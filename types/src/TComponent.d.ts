export declare const version = "1.1.0";
export type ConstructorOf<T> = new (...args: any[]) => T;
export type AnyFunction = (...args: unknown[]) => unknown;
export type TAttributes = Record<string, string>;
interface IntermediateTNode {
    t: string;
    a: TAttributes;
    c: TNode[];
}
export type TNode = IntermediateTNode | string;
export declare function isObject(value: unknown): value is object;
export declare function isFunction(target: unknown): target is AnyFunction;
export declare function createDictionary<T>(): Record<string, T>;
export declare function removeNull<T>(arr: (T | null | undefined)[]): T[];
export declare function parseTemplate(src: string): TNode;
export declare function wrapFunctionWithErrorHandling(fn: AnyFunction, thisObj?: object): AnyFunction;
export declare function createEventFunction(code: string, thisObj?: object): AnyFunction;
/**
 * Merge classes and styles into components.
 * @param element - Element whose attributes are to be merged.
 * @param attrs - Attribute values passed in the constructor.
 */
export declare function mergeStyles(element: HTMLElement, attrs: TAttributes): void;
export declare function mergeAttrsWithoutStyles(element: HTMLElement, attrs: TAttributes, thisObj?: object): void;
/**
 * Merge attributes into components.
 * @param element - Element whose attributes are to be merged.
 * @param attrs - Attribute values passed in the constructor.
 * @param thisObj - TComponent instance.
 */
export declare function mergeAttrs(element: HTMLElement, attrs: TAttributes, thisObj?: object): void;
export declare function getElementById(thisObj: object, name: string): unknown;
export type TComponentUses = Record<string, ConstructorOf<object>>;
export declare function buildElement(tNode: TNode, thisObj?: object, uses?: TComponentUses): HTMLElement;
export declare function createElement(html: string, thisObj?: object, uses?: TComponentUses): HTMLElement;
export declare function bindLabel(labelElem: HTMLLabelElement, targetElem: HTMLElement): void;
export declare class TComponent {
    static uses?: TComponentUses;
    static template: string;
    static parsedTemplate?: TNode;
    readonly element: HTMLElement;
    parentComponent: TComponent | null;
    static from<T extends typeof TComponent>(this: T, element: unknown): InstanceType<T> | null;
    constructor(attrs?: TAttributes, nodes?: Node[], parent?: object);
    protected id(id: string): unknown;
    protected id<T>(id: string, constructor: ConstructorOf<T>): T;
    onerror(error: unknown): void;
}
export default TComponent;
