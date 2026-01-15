import type { AnyObject, ArbitraryFunc, ObjectKeys } from "#type-declarations/tools"

import { OBJECT_PROTO } from "../../runtime/constants"

export function any(v: any) {
    return v
}

export function notEqual(a: any, b: any) {
    return a !== a ? b === b : a !== b
}

export function optc(v: any) {
    return OBJECT_PROTO.toString.call(v).slice(8, -1)
}

export function escapeRegExpSource(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function hasOwn(o: AnyObject, key: ObjectKeys) {
    return OBJECT_PROTO.hasOwnProperty.call(o, key)
}

export function runAll<T extends ArbitraryFunc>(fns: T[]) {
    for (const fn of fns) {
        fn()
    }
}

export function len(target: ArrayLike<any> | undefined | null) {
    return target?.length || 0
}

export function createProxy<T extends AnyObject>(target: T, handler: ProxyHandler<T>) {
    return new Proxy(target, handler)
}
