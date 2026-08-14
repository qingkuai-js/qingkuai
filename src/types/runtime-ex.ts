import type {
    EffectHandle,
    EffectCallback,
    WatcherCallback,
    QingkuaiComponent,
    ComponentInstance
} from "#type-declarations/runtime"
import type { AnyObject, GeneralFunc, Getter } from "#type-declarations/tools"

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
        callback: WatcherCallback<T>
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
     * Examples:
     * ```ts
     * onMounted(() => {
     *     // Access DOM refs after the component is mounted.
     *     console.log("mounted", refs.panel)
     * }) // runs once after the component is mounted
     *
     * onDestroyed(() => {
     *     // Clean up subscriptions when the component is removed.
     *     unsubscribe()
     * }) // runs once before the component is destroyed
     * ```
     *
     * @param callback Contains logic to run at the target lifecycle phase.
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
     * Typical use case: access the current component's host element or the
     * exported data mounted on its instance, or register watchers, effects,
     * and lifecycle hooks that are bound to the current component. The
     * obtained instance can also be passed to `watch` or `effect` from
     * external logic, so the watcher or effect is cleaned up automatically
     * when the component is destroyed.
     *
     * This method only returns the correct instance during synchronous
     * execution of a component's setup, render, or lifecycle hooks. The
     * result is unreliable in asynchronous logic such as `setTimeout`,
     * `Promise.then`, or event handlers — call it synchronously and capture
     * the instance before using it later.
     *
     * The generic `E` describes the type of the component's exported data,
     * which is mounted on the instance, producing a typed instance reference.
     *
     * Examples:
     * ```ts
     * // Get the current component instance.
     * const instance = getCurrentInstance()
     *
     * // Passing a generic provides correct type hints.
     * const component = getCurrentInstance<{ count: number }>()
     * ```
     *
     * @returns The current component instance, or `null` when no component
     * is active. The result is unreliable in asynchronous logic.
     */
    <E extends Record<string, any> | void = void>(): ComponentInstance<
        QingkuaiComponent<() => E>
    > | null
}
