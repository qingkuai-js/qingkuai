import type {
    EffectHandle,
    GeneralEffectFunc,
    QingkuaiComponent,
    WatchEffectCallback
} from "#type-declarations/runtime"
import type { AnyObject, GeneralFunc, Getter } from "./tools"

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
 *   // Keep script/style escaped, but escape iframe tags explicitly.
 *   escapeTags: ["iframe"]
 * }
 * ```
 *
 * ```ts
 * const options: HtmlBlockOptions = {
 *   // Disable style escaping for trusted CSS content.
 *   escapeStyle: false,
 *   // Keep script escaping enabled for safety.
 *   escapeScript: true
 * }
 * ```
 */
export type HtmlBlockOptions = Partial<{
    escapeTags: string[]
    escapeStyle: boolean
    escapeScript: boolean
}>

export interface CreateWatcher {
    /**
     * Registers a watcher for a reactive source and runs callback logic when
     * the watched value changes.
     *
     * Typical use case: react to state transitions with side effects such as
     * logging, DOM reads, or resource lifecycle management.
     *
     * The concrete trigger timing depends on the API that uses this signature
     * (for example watch, preWatch, postWatch, or syncWatch).
     *
     * The callback receives the previous value and current value. If the
     * callback returns a cleanup function, it runs before the next callback
     * execution and when the watcher is stopped.
     *
     * @param getter Returns the value to observe.
     * @param callback Handles value changes with `(pre, cur)`.
     * @returns A control handle with stop, pause, and resume methods.
     *
     * Examples:
     * ```ts
     * const handle = watch(() => count, (pre, cur) => {
     *   // Track transitions for debugging or analytics.
     *   console.log("count changed", pre, cur)
     * })
     *
     * handle.pause()
     * // Updates during pause do not trigger the callback.
     *
     * handle.resume()
     * handle.stop()
     * ```
     *
     * ```ts
     * let timer: ReturnType<typeof setTimeout> | undefined
     *
     * const handle = postWatch(() => query, (pre, cur) => {
     *   // Cancel previous async work before scheduling a new one.
     *   timer = setTimeout(() => fetchData(cur), 300)
     *   return () => clearTimeout(timer)
     * })
     *
     * handle.stop()
     * ```
     */
    <T>(getter: Getter<T>, callback: WatchEffectCallback<T>): EffectHandle
}

export interface CreateEffect {
    /**
     * Registers a reactive side effect and reruns it when tracked
     * dependencies change.
     *
     * Typical use case: run async requests, logging, or integration logic
     * that should respond to reactive state updates.
     *
     * Dependencies are collected from reactive values accessed while the
     * callback executes. The concrete trigger timing depends on the API that
     * uses this signature (for example effect, preEffect, postEffect, or
     * syncEffect).
     *
     * If the callback returns a cleanup function, it runs before the next
     * execution and when the effect is stopped.
     *
     * @param callback Contains side-effect logic and optional cleanup return.
     * @returns A control handle with stop, pause, and resume methods.
     *
     * Examples:
     * ```ts
     * const handle = effect(() => {
     *   // This reruns when reactive values used here change.
     *   console.log("current count:", count)
     * })
     *
     * handle.pause()
     * handle.resume()
     * handle.stop()
     * ```
     *
     * ```ts
     * let timer: ReturnType<typeof setTimeout> | undefined
     *
     * const handle = postEffect(() => {
     *   // Clean up the previous timer before each rerun.
     *   timer = setTimeout(() => syncToServer(keyword), 200)
     *   return () => clearTimeout(timer)
     * })
     *
     * handle.stop()
     * ```
     */
    (callback: GeneralEffectFunc): EffectHandle
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
     * @param callback Contains logic to run at the target lifecycle phase.
     * @returns Returns nothing.
     *
     * Examples:
     * ```ts
     * onMounted(() => {
     *   // Access DOM refs after the component is mounted.
     *   console.log("mounted", refs.panel)
     * })
     * ```
     *
     * ```ts
     * onDestroyed(() => {
     *   // Clean up subscriptions when the component is removed.
     *   unsubscribe()
     * })
     * ```
     */
    (callback: GeneralFunc): void
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
     * @param component The component to mount as the app root.
     * @param target Mount container element or selector string.
     * @returns Returns nothing.
     *
     * Examples:
     * ```ts
     * // Mount by passing a real DOM element.
     * const container = document.getElementById("app")!
     * mountApp(App, container)
     * ```
     *
     * ```ts
     * // Mount by passing a selector.
     * mountApp(App, "#app")
     * ```
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
     * @param value A value that may be a Qingkuai reactive proxy.
     * @returns The raw target for a proxy, or the original value.
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
     * ```
     *
     * ```ts
     * const plain = { name: "Qingkuai" }
     * const raw = toRaw(plain)
     *
     * // Plain values are returned directly.
     * console.log(raw === plain) // true
     * ```
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
     * @param callback A function to run in the next microtask. Optional.
     * @returns A promise that resolves after the callback runs (or
     * immediately if no callback was provided).
     *
     * Examples:
     * ```ts
     * // Wait for reactive state updates to settle.
     * let count = 0
     *
     * effect(() => {
     *   count++
     * })
     *
     * await nextTick()
     * // At this point, all scheduled updates have completed.
     * console.log(count) // 1
     * ```
     *
     * ```ts
     * // Provide a callback instead of awaiting.
     * nextTick(() => {
     *   console.log("updates finished")
     * })
     * ```
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
     * @param value The object that may have a reactive proxy.
     * @returns The reactive proxy if one exists, otherwise the original
     * value.
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
     * ```
     *
     * ```ts
     * const plain = { name: "Qingkuai" }
     *
     * // If the value has no reactive proxy, return the value as-is.
     * const result = toReactive(plain)
     * console.log(result === plain) // true
     * ```
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
     * @param value Initial state object with properties to share.
     * @returns A reactive proxy wrapping the initial state object.
     *
     * Examples:
     * ```ts
     * // Store module: create and export shared state.
     * import { createStore } from "qingkuai"
     *
     * export const store = createStore({
     *   isLogin: false,
     *   userInfo: null,
     *   // other shared properties...
     * })
     * ```
     *
     * ```ts
     * // Component module: import and use the store.
     * import { store } from "./store"
     *
     * // Any changes to store.isLogin trigger updates in all components
     * // that access it.
     * if (store.isLogin) {
     *   console.log("Logged in as:", store.userInfo.name)
     * }
     * ```
     */
    <T extends AnyObject>(value: T): T
}
