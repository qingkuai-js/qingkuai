import type { AnyObject, Setter } from "#type-declarations/tools"
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
import { couldReact, isShallow } from "../../util/runtime/assert"
import { isFunction, isUndefined } from "../../util/shared/assert"
import { batchUpdateWithRaw, batchUpdating } from "./optimization"
import { any, createProxy, hasOwn, len, notEqual, optc } from "../../util/shared/sundry"

export const proxyCache = new WeakMap<AnyObject, ReactivityWrapper>()
export const shallowProxyCache = new WeakMap<AnyObject, ReactivityWrapper>()

export const react = reactGen()
export const destructuringReact = destructuringReactGen(react)

export const constReact = reactGen(WRAPPER_PROXY)
export const destructuringConstReact = destructuringReactGen(constReact)

export const shallowReact = reactGen(WRAPPER_SHALLOW)
export const destructuringShallowReact = destructuringReactGen(shallowReact)

export const shallowConstReact = reactGen(WRAPPER_PROXY | WRAPPER_SHALLOW)
export const destructuringShallowConstReact = destructuringReactGen(shallowConstReact)

export function toReactive<T extends AnyObject>(value: T): T {
    return proxyCache.get(toRaw(value))?.p ?? value
}

export function toShallowReactive<T extends AnyObject>(value: T): T {
    return shallowProxyCache.get(value)?.p ?? value
}

export function createStore<T extends AnyObject>(value: T, shallow = false): T {
    return (shallow ? shallowConstReact : constReact)(value)
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
            i: len(subscription.k)
        }
        subscription.a = link.i
        activeEffect.k.push(link)
        subscription.k.push(link)
    }
}

function reactGen(declarationFlag = 0) {
    return (target: any, debugSetter?: Setter) => {
        let flag = declarationFlag
        let wrapper: ReactivityWrapper
        let cached: ReactivityWrapper | undefined
        const createWithProxy = flag & WRAPPER_PROXY
        const cache = flag & WRAPPER_SHALLOW ? shallowProxyCache : proxyCache
        if (createWithProxy) {
            if (!couldReact(target)) {
                return target
            }
            if ((cached = cache.get(target))) {
                return cached.p
            }
            flag |= any(TYPE_FLAG_MAP)[optc(target)] || WRAPPER_OBJECT
        }
        wrapper = createReactivityWrapper(target, flag, debugSetter)

        if (!cached && createWithProxy) {
            cache.set(target, wrapper)
        }
        return isUndefined(debugSetter) ? wrapper.p : [wrapper.p, target]
    }
}

function destructuringReactGen(reactFn: ReturnType<typeof reactGen>) {
    return (dfn: DestructuringFunc, target: any, debugSetters?: Setter[]) => {
        const ret: any[] = []
        const values = dfn(target)
        for (let i = 0; i < len(values); i += 2) {
            ret.push(values[i + 1] ? reactFn(values[i], debugSetters?.[i / 2]) : values[i])
        }
        return ret
    }
}

function createReactivityWrapper(target: any, flag: number, debugSetter: Setter | undefined) {
    const wrapper: ReactivityWrapper = {
        b: NIL,
        c: NIL,
        s: NIL,
        a: NIL,
        o: NIL,
        l: flag,
        p: UNDEF,
        r: target
    }
    const isChanged = isShallow(wrapper) ? notEqual : reactiveNotEqual

    if (!(flag & WRAPPER_PROXY)) {
        wrapper.p = {
            [WRAPPER]: wrapper,

            get $() {
                mutualLink(wrapper)

                if (isShallow(wrapper)) {
                    return target
                }
                return constReact(target)
            },

            set $(value) {
                if (isChanged(target, value)) {
                    if (debugSetter) {
                        debugSetter(value)
                    }
                    wrapper.r = target = value
                    scheduleUpdate(wrapper)
                }
            }
        }
    } else {
        wrapper.p = createProxy(target, {
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
                return isShallow(wrapper) ? propValue : constReact(propValue)
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
                            for (let i = 0; i < len(originElems); i++) {
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
    }

    return wrapper
}
