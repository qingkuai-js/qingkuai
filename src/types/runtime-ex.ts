import type {
    EffectHandle,
    EffectCallback,
    ComponentMember,
    WatchCallback,
    ComponentInstance,
    InstanceContexts,
    DeclaredContextKeys
} from "#type-declarations/runtime"
import type { AnyObject, GeneralFunc, Getter } from "#type-declarations/tools"
import type { COMPONENT, EmptyObject, QingkuaiComponent } from "@qingkuai/virtual/brand"

/**
 * Recovers the component type that produced a component instance.
 *
 * The instance type carries its component type through an invisible
 * type-level channel (see {@link ComponentInstance}) — this helper extracts
 * it. Typical use case: deriving the component's contract types (see
 * {@link ComponentProps}, {@link ComponentContexts}, ... ) from an instance
 * obtained at an entry point such as `getCurrentInstance` or an `&handle`
 * receiver.
 *
 * Falls back to `QingkuaiComponent<any>` (permissive) for instances that do
 * not carry the channel.
 *
 * Examples:
 * ```ts
 * type Comp = ComponentOfInstance<typeof instance>
 * type Contexts = ComponentContexts<Comp>
 * ```
 *
 * @template I A component instance type.
 */
export type ComponentOfInstance<I> = I extends {
    [COMPONENT]?: infer T
}
    ? T
    : QingkuaiComponent<any>

/**
 * The shape accepted by {@link DeclareComponent}, five optional members, one
 * per component layer. Omitted members default to `EmptyObject`, matching the
 * compiled behavior of components that declare nothing for the corresponding
 * layer.
 */
export type ComponentShape = {
    props?: AnyObject
    refs?: AnyObject
    slots?: AnyObject
    contexts?: AnyObject
    exports?: AnyObject
}

/**
 * Manually declares a component shape, producing the component type that
 * compiled component files carry. For wrapper contracts, component-typed
 * module parameters, and type-level stubs.
 *
 * The shape has five optional members. Omitted members default to
 * `EmptyObject`, matching the compiled behavior of components that declare
 * nothing for the corresponding layer.
 *
 * Component types with different shapes are mutually exclusive.
 *
 * Examples:
 * ```ts
 * type Dialog = DeclareComponent<{
 *     props: { title: string }
 *     exports: { open: () => void }
 * }>
 * ```
 *
 * @template S The manually declared component shape.
 */
export type DeclareComponent<S extends ComponentShape> = QingkuaiComponent<
    (ctx: {
        props: S["props"] extends AnyObject ? S["props"] : EmptyObject
        refs: S["refs"] extends AnyObject ? S["refs"] : EmptyObject
        slots: S["slots"] extends AnyObject ? S["slots"] : EmptyObject
        contexts: S["contexts"] extends AnyObject ? S["contexts"] : EmptyObject
    }) => S["exports"] extends AnyObject ? S["exports"] : void
>

/**
 * Extracts the **props contract** of a Qingkuai component.
 *
 * The props contract describes the properties a parent may pass to the
 * component, as declared by the component itself. Typical use case: reading
 * component prop types when writing wrapper components or higher-order
 * component utilities.
 *
 * When the component does not carry a props contract (for example, a value
 * typed as `QingkuaiComponent<any>`), the result degrades to a permissive
 * record type.
 *
 * Examples:
 * ```ts
 * type Props = ComponentProps<typeof Counter>
 * ```
 *
 * @template T A Qingkuai component type.
 */
export type ComponentProps<T extends QingkuaiComponent<any>> = ComponentMember<T, "props">

/**
 * Extracts the **refs contract** of a Qingkuai component.
 *
 * The refs contract describes the template references the component exposes
 * to its parent through `&`-prefixed attributes. Typical use case: reading
 * component ref types when writing wrapper components or debugging tools.
 *
 * When the component does not carry a refs contract (for example, a value
 * typed as `QingkuaiComponent<any>`), the result degrades to a permissive
 * record type.
 *
 * Examples:
 * ```ts
 * type Refs = ComponentRefs<typeof Form>
 * ```
 *
 * @template T A Qingkuai component type.
 */
export type ComponentRefs<T extends QingkuaiComponent<any>> = ComponentMember<T, "refs">

/**
 * Extracts the **slots contract** of a Qingkuai component.
 *
 * The slots contract describes the named slots the component accepts from
 * its parent. Typical use case: reading slot types when writing wrapper
 * components or slot-forwarding utilities.
 *
 * When the component does not carry a slots contract (for example, a value
 * typed as `QingkuaiComponent<any>`), the result degrades to a permissive
 * record type.
 *
 * Examples:
 * ```ts
 * type Slots = ComponentSlots<typeof Layout>
 * ```
 *
 * @template T A Qingkuai component type.
 */
export type ComponentSlots<T extends QingkuaiComponent<any>> = ComponentMember<T, "slots">

/**
 * Extracts the **contexts contract** of a Qingkuai component.
 *
 * The contexts contract describes the key/value mapping the component writes
 * through `setContext`-related APIs and reads through the `contexts`
 * identifier. Typical use case: type-checking runtime context writes (see
 * `setContext` and `setContextGetter`) or reading context types in tooling.
 *
 * When the component does not carry a contexts contract (for example, a value
 * typed as `QingkuaiComponent<any>`), the result degrades to a permissive
 * record type.
 *
 * Examples:
 * ```ts
 * type Contexts = ComponentContexts<typeof ThemeProvider>
 * ```
 *
 * @template T A Qingkuai component type.
 */
export type ComponentContexts<T extends QingkuaiComponent<any>> = ComponentMember<T, "contexts">

/**
 * Extracts the **exported data** of a Qingkuai component.
 *
 * The exported data is mounted on the component instance, producing the
 * instance type (see {@link ComponentInstance}). Typical use case: reading
 * the data a component exports when passing instances between modules or
 * writing component utilities.
 *
 * Examples:
 * ```ts
 * type Exports = ComponentExports<typeof Counter>
 * ```
 *
 * @template T A Qingkuai component type.
 */
export type ComponentExports<T extends QingkuaiComponent<any>> =
    T extends QingkuaiComponent<infer F> ? ReturnType<F> : any

/**
 * Configures escaping behavior for HTML block rendering.
 *
 * Typical use case: allow specific tags while keeping style or script
 * content escaped for safer output.
 *
 * - `escapeTags`: tag names that should be escaped.
 * - `escapeStyle`: whether style content should be escaped.
 * - `escapeScript`: whether script content should be escaped.
 *
 * Examples:
 * ```ts
 * const options: HtmlBlockOptions = {
 *     // Keep script/style escaped, but escape iframe tags explicitly.
 *     escapeTags: ["iframe"]
 * }
 *
 * const options: HtmlBlockOptions = {
 *     // Disable style escaping for trusted CSS content.
 *     escapeStyle: false,
 *     // Keep script escaping enabled for safety.
 *     escapeScript: true
 * }
 * ```
 */
export type HtmlBlockOptions = Partial<{
    escapeTags: string[]
    escapeStyle: boolean
    escapeScript: boolean
}>

export interface WatchFunc {
    /**
     * Registers a watcher for a reactive source and runs callback logic when
     * the watched value changes.
     *
     * Typical use case: react to state transitions with side effects such as
     * logging, DOM reads, or resource lifecycle management.
     *
     * Binding:
     * - The first argument is the component instance the watcher binds to.
     *   When the component is destroyed, the watcher is cleaned up
     *   automatically — regardless of whether it was registered in sync or
     *   async logic.
     * - Passing `null` instead of an instance binds the watcher to no
     *   component, so it is never auto-cleaned; the caller must manage its
     *   lifecycle by calling `stop()`.
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
     *   execution and when the watcher is stopped.
     *
     * Returned object:
     * - `stop()` completely stops the watcher and releases resources.
     * - `pause()` temporarily suspends invoking the callback.
     * - `resume()` resumes a previously paused watcher.
     *
     * Examples:
     * ```ts
     * const handle = watch(instance, () => count, (pre, cur) => {
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
     *
     * // Unbound watcher: cleaned up manually.
     * const handle = syncWatch(null, () => query, (pre, cur) => {
     *     // React to query changes.
     *     console.log(`query changed from ${pre} to ${cur}`)
     * })
     *
     * query = "new" // console logs: "query changed from old to new"
     * handle.stop()
     * ```
     *
     * @param instance The component instance to bind the watcher to, or `null` to leave it unbound.
     * @param getter Returns the value to observe.
     * @param callback Handles value changes with `(pre, cur)`.
     * @returns A control handle with stop, pause, and resume methods.
     */
    <T>(
        instance: ComponentInstance<any> | null,
        getter: Getter<T>,
        callback: WatchCallback<T>
    ): EffectHandle
}

export interface EffectFunc {
    /**
     * Registers a reactive side effect and reruns it when tracked
     * dependencies change.
     *
     * Typical use case: run async requests, logging, or integration logic
     * that should respond to reactive state updates.
     *
     * Binding:
     * - The first argument is the component instance the effect binds to.
     *   When the component is destroyed, the effect is cleaned up
     *   automatically — regardless of whether it was registered in sync or
     *   async logic.
     * - Passing `null` instead of an instance binds the effect to no
     *   component, so it is never auto-cleaned; the caller must manage its
     *   lifecycle by calling `stop()`.
     *
     * Trigger timing:
     * - Dependencies are collected from reactive values accessed while the
     *   callback executes.
     * - The concrete trigger timing depends on the API that uses this
     *   signature (effect, preEffect, postEffect, or syncEffect).
     * - Non-sync variants are scheduled asynchronously; their callbacks run
     *   after the current task settles.
     *
     * Callback:
     * - May return a cleanup function that runs before the next execution
     *   and when the effect is stopped.
     *
     * Returned object:
     * - `stop()` completely stops the effect and releases resources.
     * - `pause()` temporarily suspends rerunning the effect.
     * - `resume()` resumes a previously paused effect.
     *
     * Examples:
     * ```ts
     * const handle = effect(instance, () => {
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
     *
     * // Unbound effect: cleaned up manually.
     * const handle = syncEffect(null, () => {
     *     // Sync to external services.
     *     console.log(`syncing count: ${count}`)
     * })
     *
     * handle.stop()
     * ```
     *
     * @param instance The component instance to bind the effect to, or `null` to leave it unbound.
     * @param callback Contains side-effect logic and optional cleanup return.
     * @returns A control handle with stop, pause, and resume methods.
     */
    (instance: ComponentInstance<any> | null, callback: EffectCallback): EffectHandle
}

export interface LifecycleHookRegister {
    /**
     * Registers a lifecycle hook callback for component-level side effects.
     *
     * Typical use case: attach setup or teardown logic to a component phase,
     * such as reading refs after mount or releasing resources before destroy.
     *
     * The callback is invoked when the corresponding lifecycle phase is
     * reached.
     *
     * The target instance must be passed explicitly — this is the external
     * form. Inside components the built-in binding closures inject the
     * instance automatically, so the hook is called with the callback alone.
     *
     * Example:
     * ```ts
     * onMounted(instance, () => {
     *     unsubscribe()
     * }) // runs once before the component is destroyed
     * ```
     *
     * @param instance The target component instance.
     * @param callback Contains logic to run at the target lifecycle phase.
     */
    (instance: ComponentInstance<any>, callback: GeneralFunc): void
}

export interface MountAppFunc {
    /**
     * Mounts a Qingkuai component to a target container.
     *
     * Typical use case: start an app by attaching its root component to
     * an existing DOM element or a CSS selector.
     *
     * If the target is a selector string, the runtime resolves it to an
     * element before mounting.
     *
     * Examples:
     * ```ts
     * // Mount by passing a real DOM element.
     * const container = document.getElementById("app")!
     * mountApp(App, container)
     *
     * // Mount by passing a selector.
     * mountApp(App, "#app")
     * ```
     *
     * @param component The component to mount as the app root.
     * @param target Mount container element or selector string.
     */
    (component: QingkuaiComponent<any>, target: Element | string): void
}

export interface ToRawFunc {
    /**
     * Returns the underlying raw value from a reactive wrapper.
     *
     * Typical use case: compare identity with non-reactive data or pass
     * plain values to third-party libraries that should not receive proxies.
     *
     * If the input is not wrapped, this function returns the input as-is.
     *
     * Examples:
     * ```ts
     * const inner = {}
     * const outer = reactive({ inner })
     *
     * // The nested value is wrapped when accessed through a reactive object.
     * console.log(outer.inner === inner) // false
     *
     * // `toRaw` restores identity to the original object.
     * console.log(toRaw(outer.inner) === inner) // true
     * console.log(toRaw(outer).inner === inner) // true
     *
     * const plain = { name: "Qingkuai" }
     * const raw = toRaw(plain)
     *
     * // Plain values are returned directly.
     * console.log(raw === plain) // true
     * ```
     *
     * @param value A value that may be a Qingkuai reactive proxy.
     * @returns The raw target for a proxy, or the original value.
     */
    <T>(value: T): T
}

export interface NextTickFunc {
    /**
     * Schedules a callback to run after the current execution completes.
     *
     * Typical use case: wait for reactive updates to flush before making
     * assertions in tests or performing post-update operations.
     *
     * Uses the microtask queue (Promise.then), so the callback runs after
     * synchronous execution finishes but before the next UI render.
     *
     * Examples:
     * ```ts
     * // Wait for reactive state updates to settle.
     * let count = 0
     *
     * effect(() => {
     *     count++
     * })
     *
     * await nextTick()
     * // At this point, all scheduled updates have completed.
     * console.log(count) // 1
     *
     * // Provide a callback instead of awaiting.
     * nextTick(() => {
     *     console.log("updates finished")
     * })
     * ```
     *
     * @param callback A function to run in the next microtask. Optional.
     * @returns A promise that resolves after the callback runs (or
     * immediately if no callback was provided).
     */
    (callback?: GeneralFunc): Promise<void>
}

export interface ToReactiveFunc {
    /**
     * Returns the reactive proxy for a value that was already made reactive.
     *
     * Typical use case: obtain the reactive proxy of a value when you need
     * to work with its tracked properties.
     *
     * This function does not add new reactive capability; it only retrieves
     * an existing proxy. If the value was not inferred or explicitly marked
     * as reactive by the compiler, the original value is returned.
     *
     * Examples:
     * ```ts
     * const obj = { count: 0 }
     * const shallowReactiveObj = shallow(obj)
     *
     * // Retrieve the shallow reactive proxy from a raw value.
     * const proxy = toReactive(obj)
     * console.log(proxy === shallowReactiveObj) // true
     *
     * // Changes trigger reactivity (shallow level only).
     * proxy.count++
     *
     * const plain = { name: "Qingkuai" }
     *
     * // If the value has no reactive proxy, return the value as-is.
     * const result = toReactive(plain)
     * console.log(result === plain) // true
     * ```
     *
     * @param value The object that may have a reactive proxy.
     * @returns The reactive proxy if one exists, otherwise the original
     * value.
     */
    <T extends AnyObject>(value: T): T
}

export interface createStoreFunc {
    /**
     * Creates a shared reactive state store that can be imported and used
     * across multiple components.
     *
     * Typical use case: centralize application state such as user session,
     * global configuration, or shared data that multiple components need
     * to read and update together.
     *
     * The returned object is reactive, so any property changes will
     * automatically trigger updates in all components that access it.
     *
     * Examples:
     * ```ts
     * // Store module: create and export shared state.
     * import { createStore } from "qingkuai"
     *
     * export const store = createStore({
     *     isLogin: false,
     *     userInfo: null,
     *     // other shared properties...
     * })
     *
     * // Component module: import and use the store.
     * import { store } from "./store"
     *
     * // Any changes to store.isLogin trigger updates in all components
     * // that access it.
     * if (store.isLogin) {
     *     console.log("Logged in as:", store.userInfo.name)
     * }
     * ```
     *
     * @param value Initial state object with properties to share.
     * @returns A reactive proxy wrapping the initial state object.
     */
    <T extends AnyObject>(value: T): T
}

export interface GetCurrentInstanceFunc {
    /**
     * Returns the component instance that is currently being initialized or
     * updated.
     *
     * Typical use case: pass the instance to external APIs (framework APIs
     * like `setContext`, or third-party functions that accept instances), or
     * register watchers, effects, and lifecycle hooks that are bound to the
     * current component. The obtained instance can also be passed to `watch`
     * or `effect` from external logic, so the watcher or effect is cleaned up
     * automatically when the component is destroyed.
     *
     * Note：
     * - This function only returns the correct instance during synchronous
     *   execution of a component's initialization or update phase. The result
     *   is unreliable in asynchronous logic such as `setTimeout`,
     *   `Promise.then`, or event handlers — call it synchronously and capture
     *   the instance before using it later.
     * - Exported data is mounted on the instance only after the component's
     *   `mount` completes. Reading exports synchronously during initialization
     *   returns `undefined`, even when the type suggests otherwise.
     *
     * Examples:
     * ```ts
     * // Get the current component instance (permissive typing).
     * const instance = getCurrentInstance()
     *
     * // Pass a component type for contract-typed access.
     * const typed = getCurrentInstance<typeof Comp>()
     * const typedContexts = getContexts(typed)
     * typedContexts.theme
     * ```
     *
     * @returns The current component instance, or `null` when no component
     * is active.
     */
    <T extends QingkuaiComponent<any> = QingkuaiComponent<any>>(): ComponentInstance<T> | null
}

export interface SetContextFunc {
    /**
     * Writes a context value into the contexts layer of the specified
     * component instance.
     *
     * The context contract of the component is honored: `key` must be one of
     * the context keys declared by the component (see
     * {@link ComponentContexts}), and `value` must match the corresponding
     * declared type. When the component declares no context keys, the call
     * degrades to a permissive signature.
     *
     * The write lands on the instance's own layer, shadowing any same-named
     * key inherited from the parent; the parent value is unaffected.
     *
     * Examples:
     * ```ts
     * // Set a static value
     * setContext(instance, "theme", "dark")
     *
     * // Set a reactive value
     * let theme = reactive(0)
     * setContext(instance, "getCount", () => count)
     *
     * // Reactive read in a descendant:
     * contexts.getCount()
     * ```
     *
     * @param instance The target component instance
     * @param key The context key.
     * @param value The context value.
     */
    <I extends ComponentInstance<any>, K extends DeclaredContextKeys<I>>(
        instance: I,
        key: K,
        value: K extends never ? never : InstanceContexts<I>[K]
    ): void
}

export interface SetContextGetterFunc {
    /**
     * Writes a context value as a getter into the contexts layer of the
     * specified component instance.
     *
     * The context contract of the component is honored: `key` must be one of
     * the context keys declared by the component (see
     * {@link ComponentContexts}), and the getter must return the
     * corresponding declared type. When the component declares no context
     * keys, the call degrades to a permissive signature.
     *
     * Unlike `setContext`, which stores a static value, `setContextGetter`
     * stores a getter function. When `contexts[key]` is read anywhere in the
     * component tree, the getter is **automatically invoked by the framework**
     * — the user never calls `getter()` manually. This enables:
     *
     * - **Lazy evaluation**: the getter runs only when the value is actually
     *   read.
     * - **Reactive tracking**: if the getter accesses reactive state, the
     *   framework automatically tracks dependencies and schedules updates when
     *   they change.
     *
     * Use `setContext` when the value is static or you want to store a function
     * as a plain value (without auto-invocation). Use `setContextGetter` when
     * the value should be recomputed on each read and/or needs reactive tracking.
     *
     * Examples:
     * ```ts
     * // Set a reactive value as a context getter.
     * let count = shallow(0)
     * setContextGetter(instance, "count", () => count)
     *
     * // Reactive read in a descendant:
     * contexts.count
     * ```
     *
     * @param instance The target component instance
     * @param key The context key.
     * @param getter The getter function that returns the current context value.
     */
    <I extends ComponentInstance<any>, K extends DeclaredContextKeys<I>>(
        instance: I,
        key: K,
        getter: K extends never ? never : Getter<InstanceContexts<I>[K]>
    ): void
}

export interface GetContextsFunc {
    /**
     * Returns the contexts chain-head object of the specified component
     * instance.
     *
     * The returned object is typed with the context contract of the
     * component (see {@link ComponentContexts}) — declared context keys and
     * their value types are preserved.
     *
     * Reads inherit parent/ancestor contexts along the prototype chain
     * automatically.
     *
     * @param instance The target component instance.
     */
    <I extends ComponentInstance<any>>(instance: I): InstanceContexts<I> | null
}
