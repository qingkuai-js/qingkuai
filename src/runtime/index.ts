export {
    onAfterMount,
    onAfterUpdate,
    onAfterDestroy,
    onBeforeMount,
    onBeforeUpdate,
    onBeforeDestroy
} from "./instance"

// prettier-ignore
export {
    watch, 
    effect, 
    preWatch, 
    preEffect, 
    syncWatch, 
    syncEffect
} from "./reactivity/effect"

export { mountApp } from "./h"
export { nextTick } from "./schedule"
export { raw, createStore, updateWithRaw } from "./reactivity/value"
