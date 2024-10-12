import type { QingKuaiComponent } from "./instance"
import type { EffectListItem, UpdateFunc } from "./types"

import { noop } from "./constants"
import { resolvedPromise } from "./promise"
import { isNull } from "../util/shared/assert"
import { invokeIndexedHooks } from "./instance"
import { flushWatchEffect } from "./reactivity/effect"

let updateLock = false

const updateList = new Set<EffectListItem[0]>()

export function scheduleUpdate(item: Set<UpdateFunc>) {
    updateList.add(item)

    if (updateLock) {
        return
    }

    resolvedPromise.then(function update() {
        const calledFuncs: UpdateFunc[] = []
        const updatingComponents = new Set<QingKuaiComponent>()

        flushWatchEffect("pre")

        updateList.forEach(list => {
            list.forEach(fn => {
                const component = fn.instance!
                const properties = component.__
                if (isNull(properties)) {
                    return list.delete(fn)
                }
                if (!fn.called) {
                    const componentIsUpdating = updatingComponents.has(component)
                    if (fn() && properties && !componentIsUpdating) {
                        invokeIndexedHooks(component, 2)
                        updatingComponents.add(component)
                    }
                    calledFuncs.push(fn)
                    fn.called = true
                }
            })
            updateList.delete(list)
        })

        flushWatchEffect("post")

        calledFuncs.forEach(fn => {
            fn.called = false
        })
        updatingComponents.forEach(component => {
            invokeIndexedHooks(component, 3)
            updatingComponents.delete(component)
        })
        updateLock = false
    })
    updateLock = true
}

// 新建事件循环微任务
export function nextTick(fn?: () => void) {
    return resolvedPromise.then(fn || noop)
}

export { updateList }
