export declare const version = "1.1.0";
export type TAttributes = Record<string, string>;
export type TNode = string | {
    t: string;
    a: TAttributes;
    c: TNode[];
};
export declare function parseTemplate(src: string): TNode;
export type Constructable = new (...args: any[]) => object;
export declare function removeUndefined<T>(arr: (T | undefined | null)[]): T[];
export declare function isObject(value: unknown): value is object;
export declare function handleFunctionError(fn: unknown, thisObj?: object): (...args: unknown[]) => unknown;
export declare function createEventFunction(code?: string, thisObj?: object): (event?: unknown) => unknown;
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
export type TComponentUses = Record<string, Constructable>;
export declare function buildElement(tNode: TNode, thisObj?: object, uses?: TComponentUses): HTMLElement;
export declare function createElement(html: string, thisObj?: object, uses?: TComponentUses): HTMLElement;
export declare function bindLabel(labelElem: HTMLLabelElement, targetElem: HTMLElement): void;
export declare class TComponent {
    private static nodeMap;
    static uses?: TComponentUses;
    static template: string;
    static parsedTemplate: TNode;
    readonly element: HTMLElement;
    readonly parentComponent?: TComponent;
    static from<T extends typeof TComponent>(this: T, element: Element): InstanceType<T> | undefined;
    constructor(attrs?: TAttributes, nodes?: Node[], parent?: object);
    protected id(name: string): unknown;
    onerror(error: unknown): void;
}
export default TComponent;
