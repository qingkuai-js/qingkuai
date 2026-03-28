import type { PropertyInfo } from "#type-declarations/runtime"
import type { AnyObject, ArbitraryFunc } from "#type-declarations/tools"

import {
    OWN_KEYS,
    WRAPPER,
    PROP_HAS,
    PROP_IN,
    PROP_OWN,
    WRAPPER_MAP,
    WRAPPER_SET,
    WRAPPER_ARRAY,
    PROP_ITERATOR,
    ITERATOR_KEYS,
    LINK_IN_CHANGED,
    LINK_HAS_CHANGED,
    LINK_OWN_CHANGED,
    LINK_VALUE_CHANGED,
    SUB_IS_ITERATOR_KEY
} from "./constants"
import {
    popTrackingStack,
    pushTrackingStack,
    increBatchSyncDepth,
    decreBatchSyncDepth,
    increSchedulingPauseDepth,
    decreSchedulingPauseDepth
} from "./state"
import { REFLECT } from "../constants"
import { scheduleUpdate } from "./schedule"
import { hasOwn, notEqual } from "../../util/shared/sundry"
import { getRawProperty, toRaw, reactiveNotEqual } from "../../util/runtime/sundry"
import { isShallow, isReactive, isRefProperty, isProxyWrapper } from "../../util/runtime/assert"

export const pauseTracking = pushTrackingStack
export const resumeTracking = popTrackingStack
export const startBatchUpdating = increBatchSyncDepth
export const stopBatchUpdating = decreBatchSyncDepth
export const pauseUpdating = increSchedulingPauseDepth
export const resumeUpdating = decreSchedulingPauseDepth

export const updateWithRaw = updateWithRawGen()
export const batchUpdateWithRaw = updateWithRawGen(true)

export function noTracking<R>(fn: ArbitraryFunc<R>) {
    const result = (pauseTracking(), fn())
    return (resumeTracking(), result)
}

export function noUpdating<R>(fn: ArbitraryFunc<R>) {
    const result = (pauseUpdating(), fn())
    return (resumeUpdating(), result)
}

export function batchUpdating<R>(fn: ArbitraryFunc<R>) {
    const result = (startBatchUpdating(), fn())
    return (stopBatchUpdating(), scheduleUpdate(), result)
}

export function batchAndNoTracking<R>(fn: ArbitraryFunc<R>) {
    return batchUpdating(() => noTracking(fn))
}

function updateWithRawGen(batchSync?: boolean) {
    return <R>(value: AnyObject, operateWithRaw: (raw: any) => R) => {
        if (!isReactive(value)) {
            return operateWithRaw(value)
        }

        const wrapper = value[WRAPPER]
        if (!isProxyWrapper(wrapper)) {
            return operateWithRaw(value)
        }

        let shallowCopiedArr: any
        let iteratorKeysCount = -1
        let forceScheduleOwnKeys = false
        let forceScheduleIteratorKeys = false

        const rawValue: any = toRaw(value)
        const isMap = wrapper.l & WRAPPER_MAP
        const isArray = wrapper.l & WRAPPER_ARRAY
        const originEntries = new Map<any, PropertyInfo>()
        const isChanged = isShallow(wrapper) ? notEqual : reactiveNotEqual

        const getValue = (key: any) => {
            if (isRefProperty(key)) {
                return rawValue[key[1]]
            }
            if (isMap) {
                return rawValue.get(key)
            }
            if (wrapper.l & WRAPPER_SET) {
                return rawValue.has(key)
            }
            return rawValue[key]
        }

        const getIteratorKeysCount = () => {
            if (isArray) {
                return rawValue.length
            }
            return rawValue.size
        }

        for (let i = 0; i < 2; i++) {
            const keyInWrapper = i ? "a" : "s"
            if (!wrapper[keyInWrapper]) {
                continue
            }

            for (const [key, sub] of wrapper[keyInWrapper]) {
                if (key === OWN_KEYS) {
                    forceScheduleOwnKeys = true
                    continue
                }

                if (key === ITERATOR_KEYS) {
                    if (isArray) {
                        shallowCopiedArr = rawValue.slice()
                    } else if (isMap) {
                        const set = rawValue.set.bind(rawValue)
                        rawValue.set = (key: any, value: any) => {
                            if (!isChanged(getValue(key), value)) {
                                return
                            }
                            rawValue.set = set
                            forceScheduleIteratorKeys = false
                        }
                    }
                    forceScheduleIteratorKeys = true
                    iteratorKeysCount = getIteratorKeysCount()
                }

                let info = originEntries.get(key)
                if (!info) {
                    originEntries.set(
                        key,
                        (info = {
                            k: 0,
                            l: 0,
                            v: getValue(key)
                        })
                    )
                }
                for (let i = 0, link = sub.k[0]; link; link = sub.k[++i]) {
                    if (sub.l & SUB_IS_ITERATOR_KEY) {
                        info.l |= PROP_ITERATOR
                    }
                    if (
                        info.k & LINK_IN_CHANGED &&
                        info.k & LINK_OWN_CHANGED &&
                        info.k & LINK_HAS_CHANGED
                    ) {
                        break
                    }
                    info.k |= link.l

                    if (
                        !(info.l & PROP_IN) &&
                        link.l & LINK_IN_CHANGED &&
                        getRawProperty(key) in rawValue
                    ) {
                        info.l |= PROP_IN
                    }
                    if (
                        !(info.l & PROP_OWN) &&
                        link.l & LINK_OWN_CHANGED &&
                        hasOwn(rawValue, getRawProperty(key))
                    ) {
                        info.l |= PROP_OWN
                    }
                    if (!(info.l & PROP_HAS) && link.l & LINK_HAS_CHANGED && rawValue.has(key)) {
                        info.l |= PROP_HAS
                    }
                }
            }
        }

        const schedule = () => {
            const result = operateWithRaw(rawValue)

            for (const [key, info] of originEntries) {
                let linkFlagForSchedule = 0
                const rawKey = getRawProperty(key)

                // 下方判断条件有些复杂，拆分为内外两个 if 以便阅读：
                // 外层用于判断副作用是否会被某项变化触发，内层用于判断该项变化是否发生
                //
                // The following conditions are a bit complex, so they are split into two layers of if statements for better readability:
                // The outer layer is used to determine whether the effect will be triggered by a certain change,
                // and the inner layer is used to determine whether that change has occurred.
                if (info.k & LINK_OWN_CHANGED) {
                    if (!!(info.l & PROP_OWN) != hasOwn(rawValue, rawKey)) {
                        forceScheduleOwnKeys = false
                        linkFlagForSchedule |= LINK_OWN_CHANGED
                    }
                }
                if (info.k & LINK_HAS_CHANGED) {
                    if (!!(info.l & PROP_HAS) != rawValue.has(key)) {
                        linkFlagForSchedule |= LINK_HAS_CHANGED
                    }
                }
                if (info.k & LINK_IN_CHANGED) {
                    if (!!(info.l & PROP_IN) != rawKey in rawValue) {
                        linkFlagForSchedule |= LINK_IN_CHANGED
                    }
                }
                if (info.k & LINK_VALUE_CHANGED) {
                    if (isChanged(info.v, getValue(key))) {
                        linkFlagForSchedule |= LINK_VALUE_CHANGED
                    }
                }
                if (linkFlagForSchedule) {
                    if (info.l & PROP_ITERATOR) {
                        forceScheduleIteratorKeys = false
                    }
                    scheduleUpdate(wrapper, key, linkFlagForSchedule)
                }
            }

            if (forceScheduleIteratorKeys) {
                let linkFlagForSchedule = LINK_VALUE_CHANGED
                if (getIteratorKeysCount() == iteratorKeysCount) {
                    if (isArray) {
                        for (let i = 0; i < rawValue.length; i++) {
                            if (isChanged(rawValue[i], shallowCopiedArr[i])) {
                                forceScheduleIteratorKeys = true
                                break
                            }
                            forceScheduleIteratorKeys = i == iteratorKeysCount - 1
                        }
                    }
                } else if (!isArray) {
                    linkFlagForSchedule |= LINK_HAS_CHANGED
                } else {
                    forceScheduleOwnKeys = false
                    scheduleUpdate(wrapper, OWN_KEYS, LINK_OWN_CHANGED)
                }
                if (forceScheduleIteratorKeys) {
                    scheduleUpdate(wrapper, ITERATOR_KEYS, linkFlagForSchedule)
                }
            }

            if (forceScheduleOwnKeys) {
                const ownKeys = REFLECT.ownKeys(rawValue)
                if (ownKeys.length != wrapper.o?.length) {
                    for (let i = 0; i < ownKeys.length; i++) {
                        if (ownKeys[i] != wrapper.o![i]) {
                            forceScheduleOwnKeys = false
                            break
                        }
                    }
                }
                if (forceScheduleOwnKeys) {
                    scheduleUpdate(wrapper, OWN_KEYS, LINK_OWN_CHANGED)
                }
            }

            return result
        }
        return batchSync ? batchUpdating(schedule) : schedule()
    }
}
