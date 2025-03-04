/**
 * Generic type representing a function.
 * @public
 */
export declare type AnyFunction = (...args: unknown[]) => unknown;

/**
 * Binds a label element to a target element.
 * @param labelElem - The label element.
 * @param targetElem - The target element.
 * @public
 */
export declare function bindLabel(labelElem: HTMLLabelElement, targetElem: HTMLElement): void;

/**
 * Builds an element from a TNode.
 * @param tNode - The TNode to build from.
 * @param thisObj - The object to associate with the element.
 * @param uses - The components to use.
 * @returns The built HTMLElement.
 * @public
 */
export declare function buildElement(tNode: TNode, thisObj?: object, uses?: TComponentUses): HTMLElement;

/**
 * A type alias for a constructor function that creates an instance of type `T`.
 * @public
 */
export declare interface ConstructorOf<T> {
    new (...args: any[]): T;
    prototype: T;
}

/**
 * Creates a dictionary object.
 * @returns A new dictionary object.
 * @public
 */
export declare function createDictionary<T>(): Record<string, T>;

/**
 * Creates an element from an HTML string.
 * @param html - The HTML string.
 * @param thisObj - The object to associate with the element.
 * @param uses - The components to use.
 * @returns The created HTMLElement.
 * @public
 */
export declare function createElement(html: string, thisObj?: object, uses?: TComponentUses): HTMLElement;

/**
 * Creates an event function from the given code.
 * @param code - The code for the function.
 * @param thisObj - The object that may have an onerror method.
 * @returns The created event function.
 * @public
 */
export declare function createEventFunction(code: string, thisObj?: object): AnyFunction;

/**
 * Gets an element by its ID.
 * @param thisObj - The object containing the ID map.
 * @param name - The ID of the element.
 * @returns The element with the given ID.
 * @public
 */
export declare function getElementById(thisObj: object, name: string): unknown;

/**
 * TNode type intermediate.
 * @public
 */
export declare interface IntermediateTNode {
    t: string;
    a: TAttributes;
    c: TNode[];
}

/**
 * Checks if the target is a function.
 * @param target - The target to check.
 * @returns True if the target is a function, otherwise false.
 * @public
 */
export declare function isFunction(target: unknown): target is AnyFunction;

/**
 * Checks if the value is an object.
 * @param value - The value to check.
 * @returns True if the value is an object, otherwise false.
 * @public
 */
export declare function isObject(value: unknown): value is object;

/**
 * Merge attributes into components.
 * @param element - Element whose attributes are to be merged.
 * @param attrs - Attribute values passed in the constructor.
 * @param thisObj - TComponent instance.
 * @public
 */
export declare function mergeAttrs(element: HTMLElement, attrs: TAttributes, thisObj?: object): void;

/**
 * Merges attributes into an element without merging styles.
 * @param element - The element to merge attributes into.
 * @param attrs - The attributes to merge.
 * @param thisObj - The object that may have event handlers.
 * @public
 */
export declare function mergeAttrsWithoutStyles(element: HTMLElement, attrs: TAttributes, thisObj?: object): void;

/**
 * Merge classes and styles into components.
 * @param element - Element whose attributes are to be merged.
 * @param attrs - Attribute values passed in the constructor.
 * @public
 */
export declare function mergeStyles(element: HTMLElement, attrs: TAttributes): void;

/**
 * Parses the template string.
 * @param src - The template string.
 * @returns The parsed TNode.
 * @public
 */
export declare function parseTemplate(src: string): TNode;

/**
 * Removes null and undefined values from an array.
 * @param arr - The array to filter.
 * @returns A new array without null and undefined values.
 * @public
 */
export declare function removeNull<T>(arr: (T | null | undefined)[]): T[];

/**
 * TComponent attributes.
 * @public
 */
export declare type TAttributes = Record<string, string>;

/**
 * The base class for TComponent.
 * @public
 */
declare class TComponent {
    static uses?: TComponentUses;
    static template: string;
    static parsedTemplate?: TNode;
    readonly element: HTMLElement;
    parentComponent: TComponent | null;
    /**
     * Retrieves a TComponent instance from an element.
     * @param this - The TComponent constructor.
     * @param element - The element to retrieve the instance from.
     * @returns The TComponent instance or null.
     */
    static from<T extends typeof TComponent>(this: T, element: unknown): InstanceType<T> | null;
    /**
     * Creates an instance of TComponent.
     * @param attrs - The attributes for the component.
     * @param nodes - The child nodes for the component.
     * @param parent - The parent object.
     */
    constructor(attrs?: TAttributes, nodes?: Node[], parent?: object);
    /**
     * Retrieves an element by its ID.
     * @param id - The ID of the element.
     * @returns The element with the given ID.
     */
    protected id(id: string): unknown;
    /**
     * Retrieves an element by its ID and checks its constructor.
     * @param id - The ID of the element.
     * @param constructor - The constructor to check.
     * @returns The element with the given ID.
     */
    protected id<T>(id: string, constructor: ConstructorOf<T>): T;
    /**
     * Handles errors by propagating them to the parent component or throwing them.
     * @param error - The error to handle.
     */
    onerror(error: unknown): void;
}
export { TComponent }
export default TComponent;

/**
 * A dictionary of components to use.
 * @public
 */
export declare type TComponentUses = Record<string, ConstructorOf<object>>;

/**
 * TNode type.
 * @public
 */
export declare type TNode = IntermediateTNode | string;

/**
 * The version of TComponent.
 * @public
 */
export declare const version = "1.1.2";

/**
 * Wraps a function with error handling.
 * @param fn - The function to wrap.
 * @param thisObj - The object that may have an onerror method.
 * @returns The wrapped function.
 * @public
 */
export declare function wrapFunctionWithErrorHandling(fn: AnyFunction, thisObj?: object): AnyFunction;

export { }
