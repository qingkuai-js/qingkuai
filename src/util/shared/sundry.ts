import type { AnyObject, ArbitraryFunc, ObjectKeys } from "#type-declarations/tools"

import { setPrototypeOf } from "./aliases"
import { objectKeys } from "../shared/aliases"
import { NIL, OBJECT_PROTO } from "../../runtime/constants"

export function any(v: any) {
    return v
}

export function newCleanObj() {
    return stripPrototype({})
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

export function stripPrototype<T extends AnyObject>(o: T): T {
    return (setPrototypeOf(o, NIL), o)
}

export function len(target: ArrayLike<any> | undefined | null) {
    return target?.length || 0
}

export function traverseObject<T extends AnyObject>(
    o: T,
    callback: (key: keyof T, value: T[keyof T], index: number) => void
) {
    const keys = objectKeys(o)
    for (let i = 0; i < len(keys); i++) {
        callback(keys[i], o[keys[i]], i)
    }
}

export function createProxy<T extends AnyObject>(target: T, handler: ProxyHandler<T>) {
    return new Proxy(target, handler)
}
