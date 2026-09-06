export type {
    EffectHandle,
    WatchCallback,
    EffectCallback,
    BoundWatchFunc,
    BoundEffectFunc,
    ComponentInstance,
    BoundLifecycleFunc,
    BoundSetContextFunc,
    BoundSetContextGetterFunc
} from "#type-declarations/runtime"

export type {
    ComponentProps,
    ComponentRefs,
    ComponentSlots,
    ComponentExports,
    ComponentContexts,
    ComponentShape,
    DeclareComponent,
    HtmlBlockOptions
} from "#type-declarations/runtime-ex"

export {
    onAfterMount,
    onBeforeUpdate,
    onAfterUpdate,
    onBeforeDestroy,
    onAfterDestroy
} from "./component"

export {
    watch,
    effect,
    preEffect,
    postEffect,
    syncEffect,
    preWatch,
    postWatch,
    syncWatch
} from "./reactivity/effect"

export {
    noTracking,
    noUpdating,
    pauseTracking,
    pauseUpdating,
    resumeTracking,
    resumeUpdating,
    batchUpdating,
    stopBatchUpdating,
    startBatchUpdating,
    batchAndNoTracking
} from "./reactivity/optimization"

export {
    mountApp,
    setContext,
    getContexts,
    setContextGetter,
    getCurrentInstance
} from "./component"
export { version } from "./meta"
export { DESTRUCT_HTML } from "./constants"
export { toRaw } from "../util/runtime/sundry"
export { nextTick } from "../util/runtime/sundry"
export { createStore, createShallowStore, toReactive, toShallowReactive } from "./reactivity/value"
