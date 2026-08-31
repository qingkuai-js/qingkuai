/// <reference lib="dom" />

// 此类型包用于支撑 Qingkuai 的语言服务能力；其中声明的方法仅用于类型推导与校验，不提供任何运行时实现。
//
// This type package supports Qingkuai language-service capabilities. All declared methods
// are for type inference and validation only and have no runtime implementation.

import type { HtmlBlockOptions } from "#type-declarations/runtime-ex"
import type { EmptyObject as _EmptyObject, QingkuaiComponent as _QingkuaiComponent } from "@qingkuai/virtual/brand"
import type { ComponentInstance as _ComponentInstance, EffectCallback, EffectHandle, WatchCallback } from "#type-declarations/runtime"

export namespace __qk__lsu {
    export type EmptyObject = _EmptyObject
    export type QingkuaiComponent<T extends ArbitraryFunc> = _QingkuaiComponent<T>
    export type ComponentInstance<T extends QingkuaiComponent<any>> = _ComponentInstance<T>

    export const anyValue: any
    export const getListPair: {
        <T>(value: Set<T>): [T, T]
        <K, V>(value: Map<K, V>): [V, K]
        <T>(value: Array<T>): [T, number]
        (value: number): [number, number]
        (value: string): [string, number]
        <K extends string | number | symbol, V>(value: Record<K, V>): [V, K]
    }
    export const getReturnType: <T extends ArbitraryFunc>(fn: T) => ReturnType<T>
    export const getTypeDelayMarking: (slotName: string, attrName: string, value: any) => void

    export const validateString: <T extends string>(value: T) => void
    export const validateNumber: <T extends number>(value: T) => void
    export const validateBoolean: <T extends boolean>(value: T) => void
    export const validateHtmlBlockOptions: <T extends HtmlBlockOptions>(value: T) => void
    export const validateReferenceGroup: <T extends Set<any> | Array<any>>(value: T) => void
    export const validateTargetDirectiveValue: <T extends Element | string>(value: T) => void
    export const validateEventHandler: <T extends string, H extends (ev: ExtractEventKind<T>) => any>(value: T, handler: H) => void

    export const validateHandleReceiver: {
        <T extends string, E extends ExtractElementKind<T> | null>(value: T, expected: E): void
        <C extends QingkuaiComponent<any>, R extends ComponentInstance<C> | null | undefined>(component: C, receiver: R): void
    }

    export const extractFirstArg: <T extends unknown[]>(...args: T) => T[0]
    export const confirmComponent: <T>(component: T) => T extends QingkuaiComponent<infer F> ? F : any

    // The predicates below flatten the generic parameter (e.g. `P & Required<...>`) into a
    // single mapped type. TS2677 cannot statically prove the flattened type assignable back
    // to the generic parameter at declaration time, but the language service always
    // instantiates these assertions at use sites, where assignability holds.
    // @ts-expect-error: TS2677
    export const assertRefs: <R, D>(refs: R, defaults: D) => asserts refs is RefsAssertFn<R, D>
    // @ts-expect-error: TS2677
    export const assertProps: <P, D>(props: P, defaults: D) => asserts props is PropsAssertFn<P, D>
    // @ts-expect-error: TS2677
    export const assertContexts: <C, D>(contexts: C, defaults: D) => asserts contexts is ContextsAssertFn<C, D>

    export const assertSetContext: <C>(fn: any, contexts: C) => asserts fn is SetContextAssertFn<C>
    export const assertSetContextExp: <C>(fn: any, contexts: C) => asserts fn is SetContextAssertFn<C>
    export const assertSetContextGetter: <C>(fn: any, contexts: C) => asserts fn is SetContextGetterAssertFn<C>
    export const assertDefaults: <P, R, C>(fn: any, props: P, refs: R, contexts: C) => asserts fn is DefaultsAssertFn<P, R, C>
}

/**
 * Marks a variable declaration as a **raw value**, preventing the Qingkuai
 * compiler from injecting any reactive semantics for the associated
 * identifier.
 *
 * When a value is wrapped with `raw`, the declared identifier will be treated
 * as a normal JavaScript variable. Reads and writes will not be transformed
 * into reactive access, dependency tracking, or update operations.
 *
 * This helper is mainly used in component embedded script blocks to
 * explicitly disable reactive instrumentation for specific variables.
 *
 * Usage restrictions:
 * - This function **must be used in the top-level scope** of an embedded
 *   script block.
 * - It is intended for **variable declarations only**.
 *
 * In most cases `raw` is unnecessary because Qingkuai automatically treats
 * identifiers as raw when they are **not accessed in the template**, or when
 * they are **constants that are never reassigned**.
 *
 * Examples:
 * ```ts
 * // Mark the identifier as raw so it will not become reactive
 * const config = raw({ baseURL: "/api" })
 *
 * // Access remains normal JavaScript behavior
 * console.log(config.baseURL)
 *
 * // Disable reactive instrumentation for a mutable variable
 * let counter = raw(0)
 *
 * counter++ // normal increment without reactive tracking
 *
 * // Usually unnecessary: unused or immutable values are already raw
 * const version = "1.0.0"
 *
 * // raw is only needed when explicitly guaranteeing that
 * // the identifier is treated as a plain value
 * const options = raw({ debug: true })
 * ```
 *
 * @param value The value to mark as raw. Optional.
 * @returns The same value passed in, unchanged.
 */
export declare function raw<T>(value?: T): T

/**
 * Creates an alias binding for a property access expression.
 *
 * This helper allows a variable identifier to act as a shorthand for a
 * property access. After compilation, all references to the declared
 * identifier will be replaced with the original property access expression.
 *
 * It is commonly used to simplify access to nested properties such as
 * component `props` or `refs`, improving readability while preserving the
 * original access semantics.
 *
 * Main purposes:
 * - Provide a shorter identifier for repeated property access
 * - Improve readability when accessing nested props or refs
 * - Preserve the original access path through compile-time replacement
 *
 * Usage restrictions:
 * - This function **must be used in the top-level scope** of an embedded
 *   script block.
 * - It can **only be used as the initializer of a variable declaration**.
 * - The argument must be a **property access expression**. When the argument
 *   is an identifier, the declaration must be a **destructuring binding**.
 *
 * This capability should not be overused. In practice it is recommended to
 * limit its usage primarily to **props** and **refs** access.
 *
 * Examples:
 * ```ts
 * // Create a convenient alias for a prop value
 * const userName = alias(props.user.name)
 *
 * // All accesses to `userName` will be compiled to `props.user.name`
 * console.log(userName)
 *
 * // Alias a DOM ref property and modify it through the alias
 * const inputValue = alias(refs.searchInput.value)
 *
 * // compiled to: refs.searchInput.value = "hello"
 * inputValue = "hello"
 *
 * // When aliasing an identifier, destructuring must be used
 * const { user } = alias(props)
 *
 * console.log(user.name) // -> props.user.name
 * ```
 *
 * @param value A property access expression, or an object to destructure.
 * @returns The original value passed in, unchanged.
 */
export declare function alias<T>(value: T): T

/**
 * Marks a variable declaration as **shallow reactive**.
 *
 * When a value is wrapped with `shallow`, the declared identifier will
 * participate in reactive updates only at a shallow level. The compiler
 * injects reactive semantics for the identifier itself, while avoiding deep
 * tracking of nested structures.
 *
 * The exact shallow behavior depends on the declaration type:
 * - For **`let` / `var` declarations**, the variable value itself is treated
 *   as reactive.
 * - For **`const` declarations**, the variable binding is fixed, so the
 *   **first-level properties of the object** are treated as reactive instead.
 *
 * This helper is useful when reactive updates are required but deep
 * reactivity would be unnecessary or undesirable.
 *
 * Usage restrictions:
 * - This function **must be used as the initializer of a variable
 *   declaration**.
 * - It can **only be used in the top-level scope** of an embedded script
 *   block.
 *
 * In `<lang-js shallow>` or `<lang-ts shallow>` mode this helper is usually
 * unnecessary. The Qingkuai compiler will analyze identifiers automatically
 * and determine whether reactive semantics are required.
 *
 * Characteristics:
 * - It can be used with **destructuring declarations**.
 * - When used with destructuring, **all declared identifiers** are treated
 *   as shallow reactive.
 *
 * Examples:
 * ```ts
 * // For `let`, the variable itself is shallow reactive
 * let state = shallow({ count: 0 })
 *
 * // Reassigning the variable triggers reactive updates
 * state = { count: 1 }
 *
 * // Nested mutations are plain operations
 * state.count++
 *
 * // For `const`, first-level properties are shallow reactive
 * const state = shallow({
 *     count: 0,
 *     user: { name: "Alice" }
 * })
 *
 * state.count++        // reactive update
 * state.user.name = "" // plain nested mutation
 *
 * // Destructuring produces multiple shallow reactive identifiers
 * let { width, height } = shallow(props.size)
 *
 * width = 200 // reactive update
 * height = 100 // reactive update
 * ```
 *
 * @param value The value to mark as shallow reactive. Optional.
 * @returns The same value passed in, unchanged.
 */
export declare function shallow<T>(value?: T): T

/**
 * Marks a variable declaration as **deep reactive**, recursively converting
 * the value and all nested properties into reactive bindings.
 *
 * In deep reactive mode, every level of the object is tracked by the compiler.
 * Any modification to the variable itself or to any nested property will
 * trigger reactive updates in the component.
 *
 * By default, QingKuai treats values as deeply reactive when no explicit
 * compiler configuration overrides this behavior. If a project uses explicit
 * modes, deep reactive can be declared with
 * `<lang-js reactive>` or `<lang-ts reactive>` blocks.
 *
 * The exact behavior depends on the declaration type:
 * - For **`let` / `var` declarations**, the variable value itself and all
 *   nested properties are reactive.
 * - For **`const` declarations**, the binding is fixed, but all first-level
 *   and nested properties are deeply reactive.
 *
 * Usage restrictions:
 * - This function **must be used as the initializer of a variable
 *   declaration**.
 * - It can **only be used in the top-level scope** of an embedded script
 *   block.
 *
 * Characteristics:
 * - Can be used with **destructuring declarations**.
 * - All identifiers declared via destructuring will be deeply reactive.
 *
 * Examples:
 * ```ts
 * // For `let`, the variable and all nested properties are reactive
 * let state = reactive({
 *     count: 0,
 *     user: { name: "Alice" }
 * })
 *
 * state.count++           // reactive update
 * state.user.name = "Bob" // reactive update
 *
 * // For `const`, all nested properties are deeply reactive
 * const config = reactive({
 *     url: "/api",
 *     options: { timeout: 1000 }
 * })
 *
 * config.options.timeout = 2000 // reactive update
 *
 * // Destructuring with `let` produces multiple deeply reactive identifiers
 * let { width, height } = reactive(props.size)
 *
 * width = 200 // reactive update
 * height = 100 // reactive update
 * ```
 *
 * @param value The value to make deeply reactive. Optional.
 * @returns The same value passed in, unchanged.
 */
export declare function reactive<T>(value?: T): T

/**
 * Creates a **derived reactive value** from a getter function.
 *
 * A derived reactive value automatically tracks all reactive dependencies
 * accessed inside the `getter`. Whenever any of these dependencies change,
 * reading the derived value will return the updated result from the getter.
 *
 * This allows you to compute reactive values that are always synchronized
 * with their dependencies without manually updating them.
 *
 * Usage restrictions:
 * - This function **must be used in the top-level scope** of an embedded
 *   script block.
 * - It can **only be used as the initializer of a variable declaration**.
 *
 * Characteristics:
 * - Supports **destructuring declarations**.
 * - All identifiers declared via destructuring inherit derived reactivity.
 *
 * Examples:
 * ```ts
 * // Basic derived value
 * const doubleCount = derived(() => state.count * 2)
 *
 * console.log(doubleCount) // returns state.count * 2
 *
 * // Destructuring derived value
 * const { age, fullName } = derived(() => ({
 *     age: user.age,
 *     fullName: user.firstName + " " + user.lastName
 * }))
 *
 * console.log(age)      // reactive to changes in user.age
 * console.log(fullName) // reactive to changes in user.firstName or user.lastName
 *
 * // Derived value updates automatically when dependencies change
 * state.count = 5
 * console.log(doubleCount) // automatically updates to 10
 * ```
 *
 * @param getter A function that computes the derived value.
 * @returns The derived reactive value.
 */
export declare function derived<T>(getter: Getter<T>): T

/**
 * Creates a **derived reactive value** from a reactive expression.
 *
 * Similar to `derived`, this helper automatically tracks all reactive
 * dependencies inside the provided expression. Whenever any dependency
 * changes, reading the derived value will return the updated result.
 *
 * The key difference from `derived` is that `derivedExp` accepts a direct
 * expression instead of a getter function. The compiler automatically
 * converts the expression into a getter internally.
 *
 * Usage restrictions:
 * - This function **must be used in the top-level scope** of an embedded
 *   script block.
 * - It can **only be used as the initializer of a variable declaration**.
 *
 * Characteristics:
 * - Supports **destructuring declarations**.
 * - All identifiers declared via destructuring inherit derived reactivity.
 *
 * Examples:
 * ```ts
 * // Basic derived expression
 * const doubleCount = derivedExp(state.count * 2)
 *
 * console.log(doubleCount) // returns state.count * 2
 *
 * // Destructuring a derived expression
 * const { age, fullName } = derivedExp({
 *     age: user.age,
 *     fullName: user.firstName + " " + user.lastName
 * })
 *
 * console.log(age)      // reactive to changes in user.age
 * console.log(fullName) // reactive to changes in user.firstName or user.lastName
 *
 * // Derived value updates automatically when dependencies change
 * state.count = 5
 * console.log(doubleCount) // automatically updates to 10
 * ```
 *
 * @param expression The reactive expression to derive from.
 * @returns The derived reactive value.
 */
export declare function derivedExp<T>(expression: T): T

interface WatchExpFunc {
    /**
     * Watches reactive dependencies inside an expression and invokes a
     * callback whenever any of them change.
     *
     * This method behaves like `watch`, but instead of requiring a getter
     * function, it accepts a reactive expression directly. The compiler
     * automatically converts the expression into a getter internally.
     *
     * Trigger timing:
     * - The concrete trigger timing depends on the API that uses this
     *   signature (watchExp, preWatchExp, postWatchExp, or syncWatchExp).
     * - Non-sync variants are scheduled asynchronously; their callbacks run
     *   after the current task settles.
     *
     * Callback:
     * - Receives the previous value and the updated value each time the
     *   reactive dependencies of the expression change.
     *
     * Returned object:
     * - `stop()` completely stops the watcher and releases resources.
     * - `pause()` temporarily suspends invoking the callback.
     * - `resume()` resumes a previously paused watcher.
     *
     * Examples:
     * ```ts
     * const watcher = watchExp(state.count * state.multiplier, (oldVal, newVal) => {
     *     console.log(`value changed from ${oldVal} to ${newVal}`)
     * })
     *
     * state.count = 2 // console logs: "value changed from 0 to 2"
     *
     * watcher.pause()
     * state.count = 3 // callback not called
     *
     * watcher.resume()
     * state.count = 4 // console logs: "value changed from 2 to 4"
     *
     * watcher.stop()
     * state.count = 5 // callback not called
     * ```
     *
     * @param expression The reactive expression to watch.
     * @param callback Handles value changes with `(oldVal, newVal)`.
     * @returns A control object with stop, pause, and resume methods.
     */
    <T>(expression: T, callback: WatchCallback<T>): EffectHandle
}

export declare const watchExp: WatchExpFunc
export declare const preWatchExp: WatchExpFunc
export declare const postWatchExp: WatchExpFunc
export declare const syncWatchExp: WatchExpFunc

interface WatchFunc {
    /**
     * Registers a watcher for a reactive source and runs a callback when
     * the watched value changes.
     *
     * Typical use case: react to state transitions with side effects such
     * as logging, DOM reads, or resource lifecycle management.
     *
     * Trigger timing:
     * - The concrete trigger timing depends on the API that uses this
     *   signature (watch, preWatch, postWatch, or syncWatch).
     * - Non-sync variants are scheduled asynchronously; their callbacks run
     *   after the current task settles.
     *
     * Callback:
     * - Receives the previous value and current value.
     * - May return a cleanup function that runs before the next callback
     *   execution.
     *
     * Returned object:
     * - `stop()` completely stops the watcher and releases resources.
     * - `pause()` temporarily suspends invoking the callback.
     * - `resume()` resumes a previously paused watcher.
     *
     * Examples:
     * ```ts
     * const handle = watch(() => count, (pre, cur) => {
     *     // Track transitions for debugging or analytics.
     *     console.log(`count changed from ${pre} to ${cur}`)
     * })
     *
     * count = 2 // console logs: "count changed from 0 to 2"
     *
     * handle.pause()
     * count = 3 // callback not called
     *
     * handle.resume()
     * count = 4 // console logs: "count changed from 2 to 4"
     *
     * handle.stop()
     * count = 5 // callback not called
     * ```
     *
     * @param getter Returns the value to observe.
     * @param callback Handles value changes with `(pre, cur)`.
     * @returns A control object with stop, pause, and resume methods.
     */
    <T>(getter: Getter<T>, callback: WatchCallback<T>): EffectHandle
}

export declare const watch: WatchFunc
export declare const preWatch: WatchFunc
export declare const postWatch: WatchFunc
export declare const syncWatch: WatchFunc

interface EffectFunc {
    /**
     * Registers a reactive side effect and reruns it when tracked
     * dependencies change.
     *
     * Typical use case: run async requests, logging, or integration logic
     * that should respond to reactive state updates.
     *
     * Trigger timing:
     * - Dependencies are collected from reactive values accessed while the
     *   callback executes.
     * - The concrete trigger timing depends on the API that uses this
     *   signature (effect, preEffect, postEffect, or syncEffect).
     * - Non-sync variants are scheduled asynchronously; their callbacks run
     *   after the current task settles.
     *
     * Returned object:
     * - `stop()` completely stops the effect and releases resources.
     * - `pause()` temporarily suspends rerunning the effect.
     * - `resume()` resumes a previously paused effect.
     *
     * Examples:
     * ```ts
     * const handle = effect(() => {
     *     // This reruns when reactive values used here change.
     *     console.log(`current count: ${count}`)
     * })
     *
     * count = 1 // console logs: "current count: 1"
     *
     * handle.pause()
     * count = 2 // effect not rerun
     *
     * handle.resume()
     * count = 3 // console logs: "current count: 3"
     *
     * handle.stop()
     * count = 4 // effect not rerun
     * ```
     *
     * @param callback Contains the side-effect logic to run.
     * @returns A control object with stop, pause, and resume methods.
     */
    (callback: EffectCallback): EffectHandle
}

export declare const effect: EffectFunc
export declare const preEffect: EffectFunc
export declare const postEffect: EffectFunc
export declare const syncEffect: EffectFunc

/**
 * Defines fallback values for optional component bindings.
 *
 * The argument is an object mapping default-value categories to their
 * default values:
 * - `props`: default values for optional props
 * - `refs`: default values for optional refs
 *
 * For each category, only keys declared as **optional** (`?`) in the
 * corresponding type may be given a default value.
 *
 * Usage restrictions:
 * - Must be called **once**, in the **top-level scope** of an embedded
 *   script block, as a **standalone expression statement**.
 * - It is evaluated **in place**: values referencing bindings declared later
 *   in the script follow JavaScript temporal dead zone rules.
 *
 * Examples:
 * ```ts
 * // Define default values for the optional props and refs
 * defaults({
 *     props: {
 *         pageSize: 10,
 *         title: "Untitled"
 *     },
 *     refs: {
 *         counter: 0
 *     }
 * })
 *
 * console.log(props.title)   // "Untitled" if not provided by the parent
 * console.log(refs.counter)  // 0 if not provided by the parent
 * ```
 *
 * @param value An object whose keys are default-value categories.
 */
//
// 占位签名：实际由顶部 AssertDefaults 断言确定
// Placeholder signature: actually determined by the AssertDefaults assertion at the top.
export declare const defaults: unknown

/**
 * Writes a context value into the current component's contexts layer.
 *
 * The value written here is readable from this component and all of its
 * descendants through the `contexts` identifier. Each component has its own
 * contexts layer whose prototype is the parent's layer, so:0
 *
 * - Writing a key here shadows any same-named key inherited from the parent;
 *   the parent value is unaffected.
 * - Descendants read the nearest value along the prototype chain.
 *
 * This is a compiler intrinsic available inside `.qk` component scripts. The
 * compiler binds it to the current component instance.
 *
 * To store a reactive value, pass a **getter**. The getter is stored
 * as-is and **not invoked automatically** — descendants must call it to
 * obtain the live value.
 *
 * Examples:
 * ```ts
 * // Set a static value
 * setContext("theme", "dark")
 *
 * // Set a reactive value
 * let count = reactive(0)
 * setContext("getCount", () => count)
 *
 * // Reactive read in a descendant:
 * contexts.getCount()
 * ```
 *
 * @param key The context key.
 * @param value The context value, or a getter to be invoked by readers.
 */
//
// 占位签名：实际由顶部 AssertDefaults 断言确定
// Placeholder signature: actually determined by the AssertDefaults assertion at the top.
export declare const setContext: unknown

/**
 * Writes a reactive getter into the current component's contexts layer.
 *
 * Unlike `setContext`, this intrinsic expects a getter function. The
 * compiler binds the call to the current component instance, and runtime
 * wraps the getter so descendants can read `contexts.key` directly while
 * staying reactive.
 *
 * Each component has its own contexts layer whose prototype is the parent's
 * layer, so:
 *
 * - Writing a key here shadows any same-named key inherited from the parent;
 *   the parent value is unaffected.
 * - Descendants read the nearest value along the prototype chain.
 *
 * This intrinsic must be called as a standalone expression.
 *
 * Examples:
 * ```ts
 * // Set a reactive value as a context getter.
 * let count = shallow(0)
 * setContextGetter("count", () => count)
 *
 * // Reactive read in a descendant:
 * contexts.count
 * ```
 *
 * @param key The context key.
 * @param getter The getter used to resolve the context value.
 */
//
// 占位签名：实际由顶部 AssertDefaults 断言确定
// Placeholder signature: actually determined by the AssertDefaults assertion at the top.
export declare const setContextGetter: unknown

/**
 * Writes a reactive value into the current component's contexts layer.
 *
 * Unlike `setContext`, the value is passed directly — descendants access it
 * as a property and it stays reactive automatically, with no need to call
 * anything.
 *
 * Each component has its own contexts layer whose prototype is the parent's
 * layer, so:
 *
 * - Writing a key here shadows any same-named key inherited from the parent;
 *   the parent value is unaffected.
 * - Descendants read the nearest value along the prototype chain.
 *
 * This is a compiler intrinsic available inside `.qk` component scripts. The
 * compiler binds it to the current component instance and wraps the value so
 * that reading the context yields the live reactive value.
 *
 * Examples:
 * ```ts
 * // Set a reactive value as a context expression.
 * let count = shallow(0)
 * setContextExp("count", count)
 *
 * // Reactive read in a descendant:
 * contexts.count
 * ```
 *
 * @param key The context key.
 * @param exp The reactive value to store.
 */
//
// 占位签名：实际由顶部 AssertDefaults 断言确定
// Placeholder signature: actually determined by the AssertDefaults assertion at the top.
export declare const setContextExp: unknown

export interface BoundLifecycleHookRegister {
    /**
     * Registers a callback to run at the corresponding component lifecycle
     * phase. The target component is the one whose built-in binding resolves
     * this call — the instance is injected automatically.
     *
     * Example:
     * ```qk
     * <lang-ts>
     *     let divElement: HTMLDivElement | null = null
     *
     *     // Access the divElement after the component is mounted
     *     onAfterMount(() => {
     *         console.log("mounted", divElement)
     *     })
     * </lang-ts>
     *
     * <div &handle={divElement}></div>
     * ```
     *
     * @param callback Contains logic to run at the target lifecycle phase.
     */
    (callback: GeneralFunc): void
}

export declare const onAfterMount: BoundLifecycleHookRegister
export declare const onBeforeUpdate: BoundLifecycleHookRegister
export declare const onAfterUpdate: BoundLifecycleHookRegister
export declare const onBeforeDestroy: BoundLifecycleHookRegister
export declare const onAfterDestroy: BoundLifecycleHookRegister

type Getter<T> = () => T
type GeneralFunc = () => void
type ArbitraryFunc = (...args: any) => any
type WithRequired<T, D> = Required<Pick<T, Extract<keyof D, keyof T>>>
type Prettify<T> = T extends infer U ? { [K in keyof U]: U[K] } : never
type ExtractEventKind<K> = K extends keyof ElementEventMap ? ElementEventMap[K] : Event
type OptionalKeysOf<T> = { [K in keyof T]-?: object extends Pick<T, K> ? K : never }[keyof T]
type CleanOptionalPick<T> = Prettify<Pick<T, Exclude<OptionalKeysOf<T>, keyof __qk__lsu.EmptyObject>>>
type CleanStrictPick<T> = [keyof CleanOptionalPick<T>] extends [never] ? __qk__lsu.EmptyObject : CleanOptionalPick<T>
type DefaultsValue<P, R, C> = { props?: CleanStrictPick<P>; refs?: CleanStrictPick<R>; contexts?: CleanStrictPick<C> }
type ExtractElementKind<K> = K extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[K] : K extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[K] : Element

type DefaultsAssertFn<P, R, C> = (value: Prettify<DefaultsValue<P, R, C>>) => void
type RefsAssertFn<R, D> = Prettify<R & WithRequired<R, D extends { refs: infer DR } ? DR : never>>
type PropsAssertFn<P, D> = Prettify<P & WithRequired<P, D extends { props: infer DP } ? DP : never>>
type ContextsAssertFn<C, D> = Prettify<C & WithRequired<C, D extends { contexts: infer DC } ? DC : never>>
type SetContextAssertFn<C> = [Exclude<keyof C, keyof __qk__lsu.EmptyObject>] extends [never] ? (key: never, value: never) => void : <K extends keyof C>(key: K, value: C[K]) => void
type SetContextGetterAssertFn<C> = [Exclude<keyof C, keyof __qk__lsu.EmptyObject>] extends [never] ? (key: never, value: never) => void : <K extends keyof C>(key: K, getter: Getter<C[K]>) => void

export {}
