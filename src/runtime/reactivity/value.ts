import type {
    Link,
    ProxyWrapper,
    AccessorWrapper,
    ReactivityWrapper,
    DestructuringFunc,
} from "#type-declarations/runtime";
import type { createStoreFunc, ToReactiveFunc } from "#type-declarations/runtime-ex";
import type { AnyObject, ArbitraryFunc, Setter, CompareFunc } from "#type-declarations/tools";

import {
    OWN_KEYS,
    WRAPPER,
    protoMap,
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
    LINK_VALUE_CHANGED,
} from "./constants";
import {
    toRaw,
    getRefProperty,
    reactiveNotEqual,
    walkWrapperChildren,
    ensureGetRefProperty,
} from "../../util/runtime/sundry";
import { reactiveMethods } from "./method";
import { NIL, UNDEF, REFLECT } from "../constants";
import { activeEffect, shouldTracking } from "./state";
import { getPrototypeOf } from "../../util/shared/aliases";
import { getSubscription, scheduleUpdate } from "./schedule";
import { couldReact, isReactive } from "../../util/runtime/assert";
import { isFunction, isUndefined } from "../../util/shared/assert";
import { batchUpdateWithRaw, batchUpdating } from "./optimization";
import { createProxy, hasOwn, notEqual, optc } from "../../util/shared/sundry";

export const proxyCache = new WeakMap<AnyObject, ReactivityWrapper>();
export const shallowProxyCache = new WeakMap<AnyObject, ReactivityWrapper>();

export const toReactive: ToReactiveFunc = value => {
    return proxyCache.get(toRaw(value))?.p ?? value;
};

export const toShallow: ToReactiveFunc = value => {
    return shallowProxyCache.get(value)?.p ?? value;
};

export const createStore: createStoreFunc = value => {
    return constReact(value);
};

export const createShallowStore: createStoreFunc = value => {
    return shallowConstReact(value);
};

export function constReact(target: any) {
    return reactWithProxy(target);
}

export function shallowConstReact(target: any) {
    return reactWithProxy(target, WRAPPER_SHALLOW);
}

export function react(target: any, debugSetter?: Setter) {
    return reactWithAncestor(target, 0, reactiveNotEqual, debugSetter, constReact);
}

export function shallowReact(target: any, debugSetter?: Setter) {
    return reactWithAncestor(target, WRAPPER_SHALLOW, notEqual, debugSetter);
}

export function destructuringShallowReact(
    dfn: DestructuringFunc,
    target: any,
    debugSetters?: Setter[],
) {
    return baseDestructuringReact(target, dfn, shallowReact, debugSetters);
}

export function destructuringConstReact(dfn: DestructuringFunc, target: any) {
    return baseDestructuringReact(target, dfn, constReact);
}

export function destructuringShallowConstReact(dfn: DestructuringFunc, target: any) {
    return baseDestructuringReact(target, dfn, shallowConstReact);
}

export function destructuringReact(dfn: DestructuringFunc, target: any, debugSetters?: Setter[]) {
    return baseDestructuringReact(target, dfn, react, debugSetters);
}

export function mutualLink(wrapper: ReactivityWrapper, property?: any, flag?: number) {
    if (!activeEffect || !shouldTracking || activeEffect.l & EFFECT_DISPOSED) {
        return;
    }
    if (isUndefined(flag)) {
        flag = LINK_VALUE_CHANGED;
    }

    const subscription = getSubscription(wrapper, property, activeEffect.t == TIMING_SYNC, true)!;
    const activeLink = subscription.k[subscription.a];
    if (activeLink?.e === activeEffect) {
        activeLink.l |= flag;
    } else {
        const link: Link = {
            l: flag,
            e: activeEffect,
            s: subscription,
            i: subscription.k.length,
        };
        subscription.a = link.i;
        activeEffect.k.push(link);
        subscription.k.push(link);
    }
}

class AccessorObject {
    declare [WRAPPER]: AccessorWrapper;

    constructor(wrapper: AccessorWrapper) {
        this[WRAPPER] = wrapper;
    }

    get $() {
        const wrapper = this[WRAPPER];
        mutualLink(wrapper);
        return wrapper.g ? wrapper.g(wrapper.r) : wrapper.r;
    }

    set $(value) {
        const wrapper = this[WRAPPER];
        if (wrapper.c(wrapper.r, value)) {
            wrapper.d?.(value);
            wrapper.r = value;
            scheduleUpdate(wrapper);
        }
    }
}

function reactWithAncestor(
    target: any,
    flag: number,
    comparator: CompareFunc,
    debugSetter: Setter | undefined,
    reactAgain?: ArbitraryFunc,
) {
    const cached = getCachedWrapper(target, flag);
    if (cached) {
        return debugSetter ? [cached, toRaw(cached)] : cached;
    }

    const wrapper = newAccessorWrapper(target, flag, comparator, debugSetter, reactAgain);
    wrapper.p = new AccessorObject(wrapper);
    return debugSetter ? [wrapper.p, target] : wrapper.p;
}

class ProxyHandler {
    declare [WRAPPER]: ProxyWrapper;

    constructor(wrapper: ProxyWrapper) {
        this[WRAPPER] = wrapper;
    }

    get(target: any, property: any, receiver: any) {
        const wrapper = this[WRAPPER];
        const flag = wrapper.l;
        if (property === WRAPPER) {
            return wrapper;
        }

        const isSetMap = flag & (WRAPPER_SET | WRAPPER_MAP);
        const prototypeKey = isSetMap | (flag & WRAPPER_ARRAY);
        const propValue = REFLECT.get(target, property, isSetMap ? target : receiver);
        mutualLink(wrapper, isSetMap ? ensureGetRefProperty(property) : property);

        // 访问 Array、Set、Map 的原型方法时，返回方法包装器
        // Return a method wrapper when accessing prototype methods of Array, Set, or Map.
        if (prototypeKey && isFunction(propValue)) {
            const origin = (protoMap()[prototypeKey] as any)[property];
            if (origin === target[property]) {
                return reactiveMethods()[prototypeKey][property] || origin;
            }
        }
        return flag & WRAPPER_SHALLOW ? propValue : constReact(propValue);
    }

    set(target: any, property: any, value: any, receiver: any) {
        const wrapper = this[WRAPPER];
        const flag = wrapper.l;
        if (property === "__proto__") {
            return this.setPrototypeOf(target, value);
        }

        let originElems: any[] | undefined;
        let hasChangedChildren: ReactivityWrapper[] | undefined;
        let linkFlagForSchedule = !hasOwn(target, property) ? LINK_OWN_CHANGED : 0;

        const originValue = target[property];
        const isArray = flag & WRAPPER_ARRAY;
        const scheduleProp = getRefProperty(flag, property);
        if (!(property in target)) {
            walkWrapperChildren(wrapper, child => {
                const notHas = !(property in child);
                if (notHas) {
                    (hasChangedChildren ??= []).push(child);
                }
                return notHas;
            });
            linkFlagForSchedule |= LINK_IN_CHANGED;
        }
        if (isArray && property === "length" && value < originValue) {
            originElems = target.slice(value);
        }
        return batchUpdating(() => {
            const result = REFLECT.set(target, property, value, receiver);
            const isChanged = flag & WRAPPER_SHALLOW ? notEqual : reactiveNotEqual;
            if (isChanged(originValue, value)) {
                linkFlagForSchedule |= LINK_VALUE_CHANGED;

                // 修改数组的 length 属性时，需以被删除的索引调度更新
                if (originElems) {
                    for (let i = 0; i < originElems.length; i++) {
                        let scheduleFlag = LINK_OWN_CHANGED;
                        const index = i + value;
                        if (!(i in target)) {
                            scheduleFlag |= LINK_IN_CHANGED;
                        }
                        if (!isUndefined(originElems[i])) {
                            scheduleFlag |= LINK_VALUE_CHANGED;
                        }
                        scheduleUpdate(wrapper, "" + index, scheduleFlag);
                    }
                }
            }
            if (isArray && linkFlagForSchedule & LINK_OWN_CHANGED) {
                scheduleUpdate(wrapper, "length");
            }
            if (hasChangedChildren) {
                for (const child of hasChangedChildren) {
                    scheduleUpdate(child, property, LINK_IN_CHANGED);
                }
            }
            return (scheduleUpdate(wrapper, scheduleProp, linkFlagForSchedule), result);
        });
    }

    deleteProperty(target: any, property: any) {
        const wrapper = this[WRAPPER];
        const flag = wrapper.l;
        let linkFlagForSchedule = 0;
        let hasChangedChildren: ReactivityWrapper[] | undefined;
        if (hasOwn(target, property)) {
            if (!(property in getPrototypeOf(target))) {
                walkWrapperChildren(wrapper, child => {
                    const notHas = !(property in child);
                    if (notHas) {
                        (hasChangedChildren ??= []).push(child);
                    }
                    return notHas;
                });
                linkFlagForSchedule |= LINK_IN_CHANGED;
            }
            linkFlagForSchedule |= LINK_OWN_CHANGED;
        }
        if (!isUndefined(target[property])) {
            linkFlagForSchedule |= LINK_VALUE_CHANGED;
        }
        return batchUpdating(() => {
            const refProp = getRefProperty(flag, property);
            const result = REFLECT.deleteProperty(target, property);
            if (hasChangedChildren) {
                for (const child of hasChangedChildren) {
                    scheduleUpdate(child, property, LINK_IN_CHANGED);
                }
            }
            return (scheduleUpdate(wrapper, refProp, linkFlagForSchedule), result);
        });
    }

    getPrototypeOf(target: any) {
        const wrapper = this[WRAPPER];
        const flag = wrapper.l;
        const proto = REFLECT.getPrototypeOf(target);
        const refProp = getRefProperty(flag, "__proto__");
        if ((mutualLink(wrapper, refProp), !proto)) {
            return proto;
        }
        return (wrapper.b = constReact(proto)[WRAPPER]).p;
    }

    setPrototypeOf(_: any, value: any) {
        const wrapper = this[WRAPPER];
        if ((wrapper.b = constReact(value)?.[WRAPPER])) {
            (wrapper.b.c ??= new Set()).add(wrapper);
        }
        return batchUpdateWithRaw(wrapper.p, raw => {
            return REFLECT.setPrototypeOf(raw, value);
        });
    }

    ownKeys(target: any) {
        const wrapper = this[WRAPPER];
        mutualLink(wrapper, OWN_KEYS, LINK_OWN_CHANGED);
        return (wrapper.o = REFLECT.ownKeys(target));
    }

    has(_: any, property: any) {
        const wrapper = this[WRAPPER];
        let currentWrapper: ProxyWrapper | undefined = wrapper;
        mutualLink(currentWrapper, getRefProperty(wrapper.l, property), LINK_IN_CHANGED);

        while (currentWrapper && !hasOwn(currentWrapper.r, property)) {
            const parent: ProxyWrapper | undefined = constReact(getPrototypeOf(currentWrapper.r))?.[
                WRAPPER
            ];
            if (!parent) {
                return false;
            }
            (parent.c ??= new Set()).add(currentWrapper);
            currentWrapper.b = currentWrapper = parent;
        }
        return !!currentWrapper;
    }
}

function reactWithProxy(target: any, flag = 0): any {
    if (isReactive(target)) {
        return target;
    }

    const cached = getCachedWrapper(target, flag);
    if (cached) {
        return cached;
    }

    if (!couldReact(target)) {
        return target;
    }

    const typeStr = optc(target);
    const typeFlag = TYPE_FLAG_MAP[typeStr] ?? WRAPPER_OBJECT;
    if (typeFlag & WRAPPER_OBJECT && typeStr !== "Object") {
        return target;
    }

    const wrapper = newProxyWrapper(target, (flag |= WRAPPER_PROXY | typeFlag));
    const proxy: any = createProxy(target, new ProxyHandler(wrapper));

    return (cacheWrapper(target, wrapper), (wrapper.p = proxy));
}

function newAccessorWrapper(
    target: any,
    flag: number,
    comparator: CompareFunc,
    debugSetter: Setter | undefined,
    reactAgain: ArbitraryFunc | undefined,
): AccessorWrapper {
    return {
        r: target,
        p: UNDEF,
        l: flag,
        s: NIL,
        a: NIL,
        c: comparator,
        d: debugSetter,
        g: reactAgain,
    };
}

function newProxyWrapper(target: any, flag: number): ProxyWrapper {
    return {
        b: NIL,
        c: NIL,
        s: NIL,
        a: NIL,
        o: NIL,
        l: flag,
        p: UNDEF,
        r: target,
    };
}

function getCachedWrapper(target: any, flag: number) {
    return (flag & WRAPPER_SHALLOW ? shallowProxyCache : proxyCache).get(target)?.p;
}

function cacheWrapper(target: any, wrapper: ReactivityWrapper) {
    (wrapper.l & WRAPPER_SHALLOW ? shallowProxyCache : proxyCache).set(target, wrapper);
}

function baseDestructuringReact(
    target: any,
    dfn: DestructuringFunc,
    reactFunc: ArbitraryFunc,
    debugSetters?: Setter[],
) {
    const ret: any[] = [];
    const values = dfn(target);
    for (let i = 0; i < values.length; i += 2) {
        ret.push(values[i + 1] ? reactFunc(values[i], debugSetters?.[i / 2]) : values[i]);
    }
    return ret;
}
