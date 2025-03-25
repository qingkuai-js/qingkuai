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

export { createApp } from "./h"
export { nextTick } from "./schedule"
export { raw } from "./reactivity/value"
export { commonMessage } from "./message/common"
