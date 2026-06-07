import type { createStoreFunc, ToReactiveFunc } from "#type-declarations/runtime-ex"
import type { AnyObject, ArbitraryFunc, Setter } from "#type-declarations/tools"
import type { Link, DestructuringFunc, ReactivityWrapper } from "#type-declarations/runtime"

import {
    OWN_KEYS,
    WRAPPER,
    PROTO_MAP,
    TIMING_SYNC,
    WRAPPER_SET,
    WRAPPER_MAP,
    WRAPPER_PROXY,
    TYPE_FLAG_MAP,
    WRAPPER_ARRAY,
    WRAPPER_OBJECT,
    WRAPPER_SHALLOW,
    EFFECT_DISPOSED,
    LINK_IN_CHANGED,
    LINK_OWN_CHANGED,
    LINK_VALUE_CHANGED
} from "./constants"
import {
    toRaw,
    getRefProperty,
    reactiveNotEqual,
    walkWrapperChildren,
    ensureGetRefProperty
} from "../../util/runtime/sundry"
import { reactiveMethods } from "./method"
import { NIL, UNDEF, REFLECT } from "../constants"
import { activeEffect, shouldTracking } from "./state"
import { getPrototypeOf } from "../../util/shared/aliases"
import { getSubscription, scheduleUpdate } from "./schedule"
import { couldReact, isReactive } from "../../util/runtime/assert"
import { isFunction, isUndefined } from "../../util/shared/assert"
import { batchUpdateWithRaw, batchUpdating } from "./optimization"
import { any, createProxy, hasOwn, notEqual, optc } from "../../util/shared/sundry"

export const proxyCache = new WeakMap<AnyObject, ReactivityWrapper>()
export const shallowProxyCache = new WeakMap<AnyObject, ReactivityWrapper>()

export const toReactive: ToReactiveFunc = value => {
    return proxyCache.get(toRaw(value))?.p ?? value
}

export const toShallowReactive: ToReactiveFunc = value => {
    return shallowProxyCache.get(value)?.p ?? value
}

export const createStore: createStoreFunc = value => {
    return constReact(value)
}

export const createShallowStore: createStoreFunc = value => {
    return shallowConstReact(value)
}

export function constReact(target: any) {
    return reactWithProxy(target)
}

export function shallowConstReact(target: any) {
    return reactWithProxy(target, WRAPPER_SHALLOW)
}

export function react(target: any, debugSetter?: Setter) {
    return reactWithAncestor(target, 0, debugSetter, constReact)
}

export function shallowReact(target: any, debugSetter?: Setter) {
    return reactWithAncestor(target, WRAPPER_SHALLOW, debugSetter)
}

export function destructuringShallowReact(
    dfn: DestructuringFunc,
    target: any,
    debugSetters?: Setter[]
) {
    return baseDestructuringReact(target, dfn, shallowReact, debugSetters)
}

export function destructuringConstReact(dfn: DestructuringFunc, target: any) {
    return baseDestructuringReact(target, dfn, constReact)
}

export function destructuringShallowConstReact(dfn: DestructuringFunc, target: any) {
    return baseDestructuringReact(target, dfn, shallowConstReact)
}

export function destructuringReact(dfn: DestructuringFunc, target: any, debugSetters?: Setter[]) {
    return baseDestructuringReact(target, dfn, react, debugSetters)
}

export function mutualLink(wrapper: ReactivityWrapper, property?: any, flag?: number) {
    if (!activeEffect || !shouldTracking || activeEffect.l & EFFECT_DISPOSED) {
        return
    }
    if (isUndefined(flag)) {
        flag = LINK_VALUE_CHANGED
    }

    const subscription = getSubscription(wrapper, property, activeEffect.t == TIMING_SYNC, true)!
    const activeLink = subscription.k[subscription.a]
    if (activeLink?.e === activeEffect) {
        activeLink.l |= flag
    } else {
        const link: Link = {
            l: flag,
            e: activeEffect,
            s: subscription,
            i: subscription.k.length
        }
        subscription.a = link.i
        activeEffect.k.push(link)
        subscription.k.push(link)
    }
}

function reactWithAncestor(
    target: any,
    flag: number,
    debugSetter?: Setter,
    reactAgain?: ArbitraryFunc
) {
    const cached = getCachedWrapper(target, flag)
    if (cached) {
        return debugSetter ? [cached, toRaw(cached)] : cached
    }

    const isChanged = flag & WRAPPER_SHALLOW ? notEqual : reactiveNotEqual
    const wrapper = newReactivityWrapper(target, flag)
    wrapper.p = {
        [WRAPPER]: wrapper,

        get $() {
            mutualLink(wrapper)
            return reactAgain ? reactAgain(target) : target
        },

        set $(value) {
            if (isChanged(target, value)) {
                debugSetter?.(value)
                wrapper.r = target = value
                scheduleUpdate(wrapper)
            }
        }
    }
    return debugSetter ? [wrapper.p, target] : wrapper.p
}

function reactWithProxy(target: any, flag = 0): any {
    if (isReactive(target)) {
        return target
    }

    const cached = getCachedWrapper(target, flag)
    if (cached) {
        return cached
    }

    if (!couldReact(target)) {
        return target
    }

    const typeStr = optc(target)
    const typeFlag = TYPE_FLAG_MAP[typeStr] ?? WRAPPER_OBJECT
    if (typeFlag & WRAPPER_OBJECT && typeStr !== "Object") {
        return target
    }

    const isShallow = flag & WRAPPER_SHALLOW
    const isChanged = isShallow ? notEqual : reactiveNotEqual
    const wrapper = newReactivityWrapper(target, (flag |= WRAPPER_PROXY | typeFlag))

    const proxy: any = createProxy(target, {
        get(target, property, receiver) {
            if (property === WRAPPER) {
                return wrapper
            }

            const isSetMap = flag & (WRAPPER_SET | WRAPPER_MAP)
            const prototypeKey = isSetMap | (flag & WRAPPER_ARRAY)
            const propValue = REFLECT.get(target, property, isSetMap ? target : receiver)
            mutualLink(wrapper, isSetMap ? ensureGetRefProperty(property) : property)

            // 访问 Array、Set、Map 的原型方法时，返回方法包装器
            // Return a method wrapper when accessing prototype methods of Array, Set, or Map.
            if (prototypeKey && isFunction(propValue)) {
                const origin = any(PROTO_MAP[prototypeKey])[property]
                if (origin === target[property]) {
                    return reactiveMethods[prototypeKey][property] || origin
                }
            }
            return isShallow ? propValue : constReact(propValue)
        },

        set(target, property, value, receiver) {
            if (property === "__proto__") {
                return this.setPrototypeOf!(target, value)
            }

            let originElems: any[] | undefined
            let hasChangedChildren: ReactivityWrapper[] | undefined
            let linkFlagForSchedule = !hasOwn(target, property) ? LINK_OWN_CHANGED : 0

            const originValue = target[property]
            const isArray = flag & WRAPPER_ARRAY
            const scheduleProp = getRefProperty(flag, property)
            if (!(property in target)) {
                walkWrapperChildren(wrapper, child => {
                    const notHas = !(property in child)
                    if (notHas) {
                        ;(hasChangedChildren ??= []).push(child)
                    }
                    return notHas
                })
                linkFlagForSchedule |= LINK_IN_CHANGED
            }
            if (isArray && property === "length" && value < originValue) {
                originElems = target.slice(value)
            }
            return batchUpdating(() => {
                const result = REFLECT.set(target, property, value, receiver)
                if (isChanged(originValue, value)) {
                    linkFlagForSchedule |= LINK_VALUE_CHANGED

                    // 修改数组的 length 属性时，需以被删除的索引调度更新
                    if (originElems) {
                        for (let i = 0; i < originElems.length; i++) {
                            let scheduleFlag = LINK_OWN_CHANGED
                            const index = i + value
                            if (!(i in target)) {
                                scheduleFlag |= LINK_IN_CHANGED
                            }
                            if (!isUndefined(originElems[i])) {
                                scheduleFlag |= LINK_VALUE_CHANGED
                            }
                            scheduleUpdate(wrapper, "" + index, scheduleFlag)
                        }
                    }
                }
                if (isArray && linkFlagForSchedule & LINK_OWN_CHANGED) {
                    scheduleUpdate(wrapper, "length")
                }
                if (hasChangedChildren) {
                    for (const child of hasChangedChildren) {
                        scheduleUpdate(child, property, LINK_IN_CHANGED)
                    }
                }
                return (scheduleUpdate(wrapper, scheduleProp, linkFlagForSchedule), result)
            })
        },

        deleteProperty(target, property) {
            let linkFlagForSchedule = 0
            let hasChangedChildren: ReactivityWrapper[] | undefined
            if (hasOwn(target, property)) {
                if (!(property in getPrototypeOf(target))) {
                    walkWrapperChildren(wrapper, child => {
                        const notHas = !(property in child)
                        if (notHas) {
                            ;(hasChangedChildren ??= []).push(child)
                        }
                        return notHas
                    })
                    linkFlagForSchedule |= LINK_IN_CHANGED
                }
                linkFlagForSchedule |= LINK_OWN_CHANGED
            }
            if (!isUndefined(target[property])) {
                linkFlagForSchedule |= LINK_VALUE_CHANGED
            }
            return batchUpdating(() => {
                const refProp = getRefProperty(flag, property)
                const result = REFLECT.deleteProperty(target, property)
                if (hasChangedChildren) {
                    for (const child of hasChangedChildren) {
                        scheduleUpdate(child, property, LINK_IN_CHANGED)
                    }
                }
                return (scheduleUpdate(wrapper, refProp, linkFlagForSchedule), result)
            })
        },

        getPrototypeOf(target) {
            const proto = REFLECT.getPrototypeOf(target)
            const refProp = getRefProperty(flag, "__proto__")
            if ((mutualLink(wrapper, refProp), !proto)) {
                return proto
            }
            return (wrapper.b = constReact(proto)[WRAPPER]).p
        },

        setPrototypeOf(_, value) {
            if ((wrapper.b = constReact(value)?.[WRAPPER])) {
                ;(wrapper.b.c ??= new Set()).add(wrapper)
            }
            return batchUpdateWithRaw(wrapper.p, raw => {
                return REFLECT.setPrototypeOf(raw, value)
            })
        },

        ownKeys(target) {
            mutualLink(wrapper, OWN_KEYS, LINK_OWN_CHANGED)
            return (wrapper.o = REFLECT.ownKeys(target))
        },

        has(_, property) {
            let currentWrapper: ReactivityWrapper | undefined = wrapper
            mutualLink(currentWrapper, getRefProperty(flag, property), LINK_IN_CHANGED)

            while (currentWrapper && !hasOwn(currentWrapper.r, property)) {
                const parent: ReactivityWrapper | undefined = constReact(
                    getPrototypeOf(currentWrapper.r)
                )?.[WRAPPER]
                if (!parent) {
                    return false
                }
                ;(parent.c ??= new Set()).add(currentWrapper)
                currentWrapper.b = currentWrapper = parent
            }
            return !!currentWrapper
        }
    })

    return (cacheWrapper(target, wrapper), (wrapper.p = proxy))
}

function newReactivityWrapper(target: any, flag: number): ReactivityWrapper {
    return {
        b: NIL,
        c: NIL,
        s: NIL,
        a: NIL,
        o: NIL,
        l: flag,
        p: UNDEF,
        r: target
    }
}

function getCachedWrapper(target: any, flag: number) {
    return (flag & WRAPPER_SHALLOW ? shallowProxyCache : proxyCache).get(target)?.p
}

function cacheWrapper(target: any, wrapper: ReactivityWrapper) {
    ;(wrapper.l & WRAPPER_SHALLOW ? shallowProxyCache : proxyCache).set(target, wrapper)
}

function baseDestructuringReact(
    target: any,
    dfn: DestructuringFunc,
    reactFunc: ArbitraryFunc,
    debugSetters?: Setter[]
) {
    const ret: any[] = []
    const values = dfn(target)
    for (let i = 0; i < values.length; i += 2) {
        ret.push(values[i + 1] ? reactFunc(values[i], debugSetters?.[i / 2]) : values[i])
    }
    return ret
}
