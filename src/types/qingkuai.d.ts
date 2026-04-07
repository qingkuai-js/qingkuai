/// <reference lib="dom" />

// 此类型包用于支撑 Qingkuai 的语言服务能力；其中声明的方法仅用于类型推导与校验，不提供任何运行时实现。
//
// This type package supports Qingkuai language-service capabilities. All declared methods
// are for type inference and validation only and have no runtime implementation.

import type { HtmlBlockOptions } from "#type-declarations/runtime-ex"
import type { QingkuaiComponent as _QingkuaiComponent } from "#type-declarations/runtime"

export namespace __qk__lsu {
    const Sign: unique symbol
    type QingkuaiComponent<F extends ArbitraryFunc> = _QingkuaiComponent<F>

    export interface EmptyObject {
        [Sign]?: never
    }

    export const anyValue: any
    export const getListPair: ReloadGetListPair
    export const getReturnType: <T extends ArbitraryFunc>(fn: T) => ReturnType<T>
    export const getTypeDelayMarking: (slotName: string, attrName: string, value: any) => void

    export const validateString: <T extends string>(value: T) => void
    export const validateNumber: <T extends number>(value: T) => void
    export const validateBoolean: <T extends boolean>(value: T) => void
    export const validateHtmlBlockOptions: <T extends HtmlBlockOptions>(value: T) => void
    export const validateReferenceGroup: <T extends Set<any> | Array<any>>(value: T) => void
    export const validateTargetDirectiveValue: <T extends HTMLElement | string>(value: T) => void
    export const validateDomReceiver: <T extends string, E extends ExtractElementKind<T> | null>(value: T, expected: E) => void
    export const validateEventHandler: <T extends string, H extends (ev: ExtractEventKind<T>) => any>(value: T, handler: H) => void

    export const confirmComponent: <T>(component: T) => T extends QingkuaiComponent<infer F> ? F : any
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
 *
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
 * ```
 *
 * ```ts
 * // Alias a DOM ref property and modify it through the alias
 * const inputValue = alias(refs.searchInput.value)
 *
 * // compiled to: refs.searchInput.value = "hello"
 * inputValue = "hello"
 * ```
 *
 * ```ts
 * // When aliasing an identifier, destructuring must be used
 * const { user } = alias(props)
 *
 * console.log(user.name) // -> props.user.name
 * ```
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
 * ```
 *
 * ```ts
 * // For `const`, first-level properties are shallow reactive
 * const state = shallow({
 *   count: 0,
 *   user: { name: "Alice" }
 * })
 *
 * state.count++        // reactive update
 * state.user.name = "" // plain nested mutation
 * ```
 *
 * ```ts
 * // Destructuring produces multiple shallow reactive identifiers
 * let { width, height } = shallow(props.size)
 *
 * width = 200 // reactive update
 * height = 100 // reactive update
 * ```
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
 *   count: 0,
 *   user: { name: "Alice" }
 * })
 *
 * state.count++           // reactive update
 * state.user.name = "Bob" // reactive update
 * ```
 *
 * ```ts
 * // For `const`, all nested properties are deeply reactive
 * const config = reactive({
 *   url: "/api",
 *   options: { timeout: 1000 }
 * })
 *
 * config.options.timeout = 2000 // reactive update
 * ```
 *
 * ```ts
 * // Destructuring with `let` produces multiple deeply reactive identifiers
 * let { width, height } = reactive(props.size)
 *
 * width = 200 // reactive update
 * height = 100 // reactive update
 * ```
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
 * ```ts
 * // Basic derived value
 * const doubleCount = derived(() => state.count * 2)
 *
 * console.log(doubleCount) // returns state.count * 2
 * ```
 *
 * ```ts
 * // Destructuring derived value
 * const { age, fullName } = derived(() => ({
 *   age: user.age,
 *   fullName: user.firstName + " " + user.lastName
 * }))
 *
 * console.log(age)      // reactive to changes in user.age
 * console.log(fullName) // reactive to changes in user.firstName or user.lastName
 * ```
 *
 * ```ts
 * // Derived value updates automatically when dependencies change
 * state.count = 5
 * console.log(doubleCount) // automatically updates to 10
 * ```
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
 * ```
 *
 * ```ts
 * // Destructuring a derived expression
 * const { age, fullName } = derivedExp({
 *   age: user.age,
 *   fullName: user.firstName + " " + user.lastName
 * })
 *
 * console.log(age)      // reactive to changes in user.age
 * console.log(fullName) // reactive to changes in user.firstName or user.lastName
 * ```
 *
 * ```ts
 * // Derived value updates automatically when dependencies change
 * state.count = 5
 * console.log(doubleCount) // automatically updates to 10
 * ```
 */
export declare function derivedExp<T>(expression: T): T

/**
 * Watches reactive dependencies inside an expression and invokes a callback
 * whenever any of them change.
 *
 * This method behaves like `watch`, but instead of requiring a getter
 * function, it accepts a reactive expression directly. The compiler will
 * automatically convert the expression into a getter internally.
 *
 * The `callback` receives the previous value and the updated value each time
 * the reactive dependencies of the expression change. This enables
 * side-effects or reactions to changes in reactive state.
 *
 * The returned object provides controls for managing the watcher:
 * - `stop()` completely stops the watcher and releases resources.
 * - `pause()` temporarily suspends invoking the callback.
 * - `resume()` resumes a previously paused watcher.
 *
 * Usage restrictions:
 * - This function **must be used as a function call**.
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
 * ```ts
 * // Watching a combination of reactive values
 * const watcher = watchExp(state.count + state.multiplier, (oldVal, newVal) => {
 *     console.log(`sum changed from ${oldVal} to ${newVal}`)
 * })
 *
 * state.count = 1
 * state.multiplier = 2 // console logs: "sum changed from 0 to 3"
 * ```
 */
export declare function watchExp<T>(expression: T, callback: WatcherCallback<T>): WatcherHandlers

/**
 * Creates a watcher from a reactive expression that reacts with
 * **pre-DOM-update priority**.
 *
 * This method works like `preWatch`, but instead of requiring a getter
 * function, it accepts a reactive expression directly. The compiler
 * automatically converts the expression into a getter internally.
 *
 * The callback is executed **before DOM updates** and before other `watch`
 * or `postWatch` watchers. This ensures that state changes can be handled
 * immediately, ahead of UI updates.
 *
 * The returned object provides controls for managing the watcher:
 * - `stop()` completely stops the watcher and releases resources.
 * - `pause()` temporarily suspends invoking the callback.
 * - `resume()` resumes a previously paused watcher.
 *
 * Usage restrictions:
 * - This function **must be used as a function call**.
 *
 * Examples:
 * ```ts
 * const watcher = preWatchExp(state.count * state.multiplier, (oldVal, newVal) => {
 *     console.log(`value changed from ${oldVal} to ${newVal}`)
 * })
 *
 * state.count = 1 // callback executes before DOM updates
 *
 * watcher.pause()
 * state.count = 2 // callback not called
 *
 * watcher.resume()
 * state.count = 3 // callback executes before DOM updates
 *
 * watcher.stop()
 * state.count = 4 // callback not called
 * ```
 *
 * ```ts
 * // Watching a combination of reactive values with pre-DOM-update priority
 * const watcher = preWatchExp(state.count + state.multiplier, (oldVal, newVal) => {
 *     console.log(`sum changed from ${oldVal} to ${newVal}`)
 * })
 *
 * state.count = 1
 * state.multiplier = 2 // callback executes before DOM updates
 * ```
 */
export declare function preWatchExp<T>(expression: T, callback: WatcherCallback<T>): WatcherHandlers

/**
 * Creates a watcher from a reactive expression that reacts with
 * **post-DOM-update priority**.
 *
 * This method behaves like `postWatch`, but instead of requiring a getter
 * function, it accepts a reactive expression directly. The compiler will
 * automatically convert the expression into a getter internally.
 *
 * The callback is executed **after DOM updates** and after other `watch`
 * or `preWatch` watchers. This is useful when side-effects should run
 * only after the UI has already been updated.
 *
 * The returned object provides controls for managing the watcher:
 * - `stop()` completely stops the watcher and releases resources.
 * - `pause()` temporarily suspends invoking the callback.
 * - `resume()` resumes a previously paused watcher.
 *
 * Usage restrictions:
 * - This function **must be used as a function call**.
 *
 * Examples:
 * ```ts
 * const watcher = postWatchExp(state.count * state.multiplier, (oldVal, newVal) => {
 *     console.log(`value changed from ${oldVal} to ${newVal}`)
 * })
 *
 * state.count = 1 // callback executes after DOM updates
 *
 * watcher.pause()
 * state.count = 2 // callback not called
 *
 * watcher.resume()
 * state.count = 3 // callback executes after DOM updates
 *
 * watcher.stop()
 * state.count = 4 // callback not called
 * ```
 *
 * ```ts
 * // Watching a combination of reactive values with post-DOM-update priority
 * const watcher = postWatchExp(state.count + state.multiplier, (oldVal, newVal) => {
 *     console.log(`sum changed from ${oldVal} to ${newVal}`)
 * })
 *
 * state.count = 1
 * state.multiplier = 2 // callback executes after DOM updates
 * ```
 */
export declare function postWatchExp<T>(expression: T, callback: WatcherCallback<T>): WatcherHandlers

/**
 * Creates a **synchronous watcher** from a reactive expression.
 *
 * This method behaves like `syncWatch`, but instead of requiring a getter
 * function, it accepts a reactive expression directly. The compiler will
 * automatically convert the expression into a getter internally.
 *
 * The callback is invoked **synchronously at the moment a dependency
 * changes**, ensuring the reaction happens immediately within the same
 * update cycle.
 *
 * The returned object provides controls for managing the watcher:
 * - `stop()` completely stops the watcher and releases resources.
 * - `pause()` temporarily suspends invoking the callback.
 * - `resume()` resumes a previously paused watcher.
 *
 * Examples:
 * ```ts
 * const watcher = syncWatchExp(state.count * state.multiplier, (oldVal, newVal) => {
 *     console.log(`value changed from ${oldVal} to ${newVal}`)
 * })
 *
 * state.count = 1 // callback executes immediately
 *
 * watcher.pause()
 * state.count = 2 // callback not called
 *
 * watcher.resume()
 * state.count = 3 // callback executes immediately
 *
 * watcher.stop()
 * state.count = 4 // callback not called
 * ```
 *
 * ```ts
 * // Watching a combination of reactive values synchronously
 * const watcher = syncWatchExp(state.count + state.multiplier, (oldVal, newVal) => {
 *     console.log(`sum changed from ${oldVal} to ${newVal}`)
 * })
 *
 * state.count = 1
 * state.multiplier = 2 // callback executes immediately
 * ```
 */
export declare function syncWatchExp<T>(expression: T, callback: WatcherCallback<T>): WatcherHandlers

/**
 * Defines default values for component **reference attributes**.
 *
 * This method specifies fallback values for reference attributes when
 * they are not provided during component instantiation. The compiler
 * uses this declaration to initialize missing reference attributes with
 * the specified defaults.
 *
 * Usage restrictions:
 * - This function **can only be called in the top-level scope** of an
 *   embedded script block.
 *
 * Examples:
 * ```ts
 * // Define default values for reference attributes
 * defaultRefs({
 *     count: 0,
 *     isOpen: false
 * })
 *
 * console.log(refs.count) // 0 if not provided by the parent
 * ```
 *
 * ```ts
 * // A reference attribute that may be passed during instantiation
 * defaultRefs({ counter: 0 })
 *
 * function increment() {
 *     refs.counter++
 * }
 * ```
 */
export declare function defaultRefs<T extends Record<string, any>>(value: T): void

/**
 * Defines default values for component props.
 *
 * This method specifies fallback values for props when they are not
 * provided during component instantiation. The compiler uses this
 * declaration to initialize missing props with the specified defaults.
 *
 * Usage restrictions:
 * - This function **can only be called in the top-level scope** of an
 *   embedded script block.
 *
 * Examples:
 * ```ts
 * // Define default values for props
 * defaultProps({
 *     pageSize: 10,
 *     title: "Untitled"
 * })
 *
 * console.log(props.title) // "Untitled" if not provided by the parent
 * ```
 *
 * ```ts
 * // Props not passed during instantiation will use these defaults
 * defaultProps({ theme: "light" })
 *
 * function toggleTheme() {
 *     console.log(props.theme)
 * }
 * ```
 */
export declare function defaultProps<T extends Record<string, any>>(value: T): void

interface ReloadGetListPair {
    <T>(value: Set<T>): [T, T]
    <K, V>(value: Map<K, V>): [V, K]
    <T>(value: Array<T>): [T, number]
    (value: number): [number, number]
    (value: string): [string, number]
    <K extends string | number | symbol, V>(value: Record<K, V>): [V, K]
}

type Getter<T> = () => T
type ArbitraryFunc = (...args: any) => any
type WatcherCallback<T> = (oldValue: T, newValue: T) => void
type WatcherHandlers = Record<"stop" | "pause" | "resume", () => void>
type ExtractEventKind<K> = K extends keyof HTMLElementEventMap ? HTMLElementEventMap[K] : Event
type ExtractElementKind<K> = K extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[K] : HTMLElement
