import type { Subscription, ComponentInstance, ReactivityWrapper } from "#type-declarations/runtime"

import {
    WRAPPER_MAP,
    ITERATOR_KEYS,
    OWN_KEYS,
    WRAPPER_SET,
    WRAPPER_ARRAY,
    TIMING_SYNC,
    SUB_SCHEDULING,
    EFFECT_DISABLED,
    EFFECT_SCHEDULING,
    LINK_OWN_CHANGED,
    LINK_VALUE_CHANGED,
    SUB_IS_ITERATOR_KEY
} from "./constants"
import {
    batchSyncDepth,
    activeEffect,
    schedulingEffects,
    asyncSchedulerIsIdle,
    resetSchedulerState,
    schedulingPauseDepth,
    resetSchedulingEffects,
    schedulingSubscriptions,
    setAsyncSchedulerIsIdle,
    increRecursionScheduleCount
} from "./state"
import { runHooks } from "../component"
import { runAndUpdateEffect } from "./effect"
import { len } from "../../util/shared/sundry"
import { nextTick } from "../../util/runtime/sundry"
import { MaximumUpdateDepthExceeded } from "../messages/error"
import { RESOLVED, AFTER_UPDATE, BEFORE_UPDATE } from "../constants"
import { isIteratorKey, isProxyWrapper } from "../../util/runtime/assert"

export function getSubscription(
    wrapper: ReactivityWrapper,
    property: any,
    sync: boolean,
    shouldCreate = false
) {
    const keyInWrapper = sync ? "s" : "a"
    const wrappedByProxy = isProxyWrapper(wrapper)
    if (!wrappedByProxy) {
        if (wrapper[keyInWrapper]) {
            return wrapper[keyInWrapper]
        }
    } else {
        if (!wrapper[keyInWrapper]) {
            if (!shouldCreate) {
                return
            }
            wrapper[keyInWrapper] = new Map()
        }

        let subscription: Subscription | undefined
        if ((subscription = wrapper[keyInWrapper].get(property))) {
            return subscription
        }
    }
    if (shouldCreate) {
        const subscription: Subscription = {
            a: -1,
            l: 0,
            k: [],
            w: wrapper,
            p: property
        }
        if (isIteratorKey(wrapper, property)) {
            subscription.l = SUB_IS_ITERATOR_KEY
        }
        if (!wrappedByProxy) {
            wrapper[keyInWrapper] = subscription
        } else {
            wrapper[keyInWrapper]!.set(property, subscription)
        }
        return subscription
    }
}

export function scheduleUpdate(
    wrapper?: ReactivityWrapper,
    property?: any,
    linkFlag = LINK_VALUE_CHANGED
) {
    if (!linkFlag || schedulingPauseDepth) {
        return
    }

    if (wrapper) {
        for (let i = 0; i < 2; i++) {
            const specifiedSub = getSubscription(wrapper, property, !i)
            if (specifiedSub) {
                extendSchedulingEffects(specifiedSub, linkFlag)
            }
            if (!isProxyWrapper(wrapper)) {
                continue
            }

            // 若 linkFlag 设置了 LINK_OWN_CHANGED 标志，则触发 OWN_KEYS 订阅
            if (linkFlag & LINK_OWN_CHANGED) {
                const sub = getSubscription(wrapper, OWN_KEYS, !i)
                if (sub) {
                    extendSchedulingEffects(sub, linkFlag)
                }
            }

            // 若响应式值类型为 Array、Set、Map 其中之一，则应固定触发 ITERATOR_KEYS 订阅
            if (wrapper.l & (WRAPPER_SET | WRAPPER_MAP | WRAPPER_ARRAY)) {
                if (
                    (specifiedSub && specifiedSub.l & SUB_IS_ITERATOR_KEY) ||
                    isIteratorKey(wrapper, property)
                ) {
                    const sub = getSubscription(wrapper, ITERATOR_KEYS, !i)
                    if (sub) {
                        extendSchedulingEffects(sub, linkFlag)
                    }
                }
            }
        }
    }

    // 同步调度，若设置了 SCHEDULER_SYNC_PILE 标志，同步副作用将阻塞至此标志位被移除时运行
    if (len(schedulingEffects[0]) && !batchSyncDepth) {
        for (const effect of getSortedEffects(0)) {
            runAndUpdateEffect(effect)
        }
    }

    // 异步调度器处于空闲状态时，创建微任务执行更新调度
    // When the async scheduler is idle, create a microtask to perform the update scheduling
    if (asyncSchedulerIsIdle && len(schedulingEffects[1])) {
        setAsyncSchedulerIsIdle(false)
        RESOLVED.then(update)
    }
}

function update() {
    const updatingComponents: ComponentInstance[] = []
    for (const effect of getSortedEffects(1)) {
        runAndUpdateEffect(effect)

        // 首次渲染副作用时，触发组件的 onBeforeUpdate 并将组件加入 updatingComponents
        // For the first render effect, trigger the component's `onBeforeUpdate` and add it to `updatingComponents`
        if (effect.m && !effect.m.u) {
            effect.m.u = true
            runHooks(effect.m, BEFORE_UPDATE)
            updatingComponents.push(effect.m)
        }
    }

    // 所有副作用执行完后，触发 updatingComponents 中组件的 onAfterUpdate
    // After all effects finish, trigger `onAfterUpdate` for all components in `updatingComponents`
    for (const component of updatingComponents) {
        component.u = false
        runHooks(component, AFTER_UPDATE)
    }

    if (!len(schedulingEffects[1])) {
        return resetSchedulerState()
    }

    // 如果挂起列表不为空，则本轮调度执行的副作用中修改了其他响应式值，这会导致调度器的递归调用
    // If the waiting list is not empty, it means that the effects executed in the current update
    // cycle have modified other reactive values, causing the scheduler to be invoked recursively.

    // 为了防止更新调度器被无限递归调用，必须将这种递归调用深度限制在一个合理范围内（当前为300）
    // This recursion depth must be capped (currently at 200) to prevent infinite recursive updates.
    if (increRecursionScheduleCount() > __qk_max_schedule_depth) {
        resetSchedulingEffects(1)
        resetSchedulerState()
        MaximumUpdateDepthExceeded()
    }
    nextTick(update)
}

// 排序规则：前置 > 未设置 > 后置，effect.t 相同时按 id 升序排序
// Sorting rules: pre > unset > post; if `effect.t` is the same, sort by id in ascending order
function getSortedEffects(index: number) {
    const ret = schedulingEffects[index].sort((a, b) => {
        return a.t - b.t || a.i - b.i
    })
    return (resetSchedulingEffects(index), ret)
}

function extendSchedulingEffects(subscription: Subscription, linkFlag: number) {
    if (!subscription || !len(subscription.k) || subscription.l & SUB_SCHEDULING) {
        return
    }

    let schedulePendingEffectCount = 0
    const index = +(subscription.k[0].e.t != TIMING_SYNC)
    for (let i = 0, link = subscription.k[0]; link; link = subscription.k[++i]) {
        if (link.e === activeEffect || link.e.l & EFFECT_DISABLED || !(link.l & linkFlag)) {
            continue
        }
        if (!(link.e.l & EFFECT_SCHEDULING)) {
            link.e.l |= EFFECT_SCHEDULING
            schedulingEffects[index].push(link.e)
        }
        schedulePendingEffectCount++
    }
    if (schedulePendingEffectCount === len(subscription.k)) {
        subscription.l |= SUB_SCHEDULING
        schedulingSubscriptions[index].push(subscription)
    }
}
