import type { Effect, Subscription } from "#type-declarations/runtime"
import type { ObjectKeys, FixedArray } from "#type-declarations/tools"

import { NIL } from "../constants"
import { SUB_SCHEDULING } from "./constants"
import { getLastElem } from "../../util/shared/arrays"

let incrementEffectId = 1
const trackingStack: boolean[] = []
const runningEffectStack: Effect[] = []

export let batchSyncDepth = 0
export let shouldTracking = true
export let schedulingPauseDepth = 0
export let recursionScheduleCount = 0
export let asyncSchedulerIsIdle = true
export let activeEffect: Effect | null = NIL

export const refProperties = new Map<ObjectKeys, unknown[]>()
export const schedulingEffects: FixedArray<Effect[], 2> = [[], []]
export const eventRegisterInfo: Record<string, FixedArray<boolean, 2>> = {}
export const schedulingSubscriptions: FixedArray<Subscription[], 2> = [[], []]

export function setAsyncSchedulerIsIdle(value: boolean) {
    return (asyncSchedulerIsIdle = value)
}

export function resetSchedulerState() {
    recursionScheduleCount = 0
    setAsyncSchedulerIsIdle(true)
}

export function resetSchedulingEffects(index: number) {
    for (const sub of schedulingSubscriptions[index]) {
        sub.l &= ~SUB_SCHEDULING
    }
    schedulingEffects[index] = []
    schedulingSubscriptions[index] = []
}

export function getIncrementEffectId() {
    return incrementEffectId++
}

export function increBatchSyncDepth() {
    return ++batchSyncDepth
}

export function decreBatchSyncDepth() {
    return --batchSyncDepth
}

export function increSchedulingPauseDepth() {
    return ++schedulingPauseDepth
}

export function decreSchedulingPauseDepth() {
    return --schedulingPauseDepth
}

export function increRecursionScheduleCount() {
    return ++recursionScheduleCount
}

export function pushTrackingStack(tracking = false) {
    trackingStack.push((shouldTracking = tracking))
}

export function popTrackingStack() {
    trackingStack.pop()

    if (!trackingStack.length) {
        return (shouldTracking = true)
    }
    return (shouldTracking = getLastElem(trackingStack)!)
}

export function pushRunningEffectStack(effect: Effect) {
    pushTrackingStack(true)
    runningEffectStack.push((activeEffect = effect))
}

export function popRunningEffectStack() {
    popTrackingStack()
    runningEffectStack.pop()

    if (!runningEffectStack.length) {
        return (activeEffect = NIL)
    }
    return (activeEffect = getLastElem(runningEffectStack)!)
}
