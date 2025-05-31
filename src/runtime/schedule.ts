import type { QingKuaiComponent } from "./instance"
import type { EffectListItem, UpdateFunc } from "./types"

import { NOOP } from "./constants"
import { resolvedPromise } from "./promise"
import { isNull } from "../util/shared/assert"
import { invokeIndexedHooks } from "./instance"
import { flushWatchEffect } from "./reactivity/effect"

// 0: free, 1: waiting, 2: updating
let updateSchedulingState = 0

const updateList = new Set<EffectListItem[0]>()

export function scheduleUpdate(item: Set<UpdateFunc>) {
    if (updateSchedulingState == 2) {
        return
    }
    updateList.add(item)

    if (updateSchedulingState == 1) {
        return
    }
    updateSchedulingState = 1

    resolvedPromise.then(function update() {
        updateSchedulingState = 2

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
        updateSchedulingState = 0
    })
}

// 新建事件循环微任务
export function nextTick(fn?: () => void) {
    return resolvedPromise.then(fn || NOOP)
}

export { updateList }
