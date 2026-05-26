import type { FormatSourceCodeFunc } from "#type-declarations/compiler-ex"
import type { AnyObject, ArbitraryFunc, ObjectKeys } from "#type-declarations/tools"

import { objectKeys } from "../shared/aliases"
import { objectAssign, setPrototypeOf } from "./aliases"
import { NIL, OBJECT_PROTO } from "../../runtime/constants"
import { formattingPreWhitespaceRE, formattingUselessWhitespaceRE } from "../../compiler/regular"

export const formatSourceCode: FormatSourceCodeFunc = (code: string) => {
    code = code.trimEnd()
    code = code.replace(formattingPreWhitespaceRE, "")

    const uselessIndentStr = formattingUselessWhitespaceRE.exec(code)![0]
    return code.replace(new RegExp(`(?<=^|\\n)${uselessIndentStr}`, "g"), "")
}

export function any(v: any) {
    return v
}

export function newCleanObj() {
    return Object.create(NIL)
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

export function cloneObject<T extends AnyObject>(o: T): T {
    return objectAssign({}, o)
}

export function runAll<T extends ArbitraryFunc>(fns: T[]) {
    for (const fn of fns) {
        fn()
    }
}

export function stripPrototype<T extends AnyObject>(o: T): T {
    return (setPrototypeOf(o, NIL), o)
}

export function traverseObject<T extends AnyObject>(
    o: T,
    callback: (key: keyof T, value: T[keyof T], index: number) => void
) {
    const keys = objectKeys(o)
    for (let i = 0; i < keys.length; i++) {
        callback(keys[i], o[keys[i]], i)
    }
}

export function createProxy<T extends AnyObject>(target: T, handler: ProxyHandler<T>) {
    return new Proxy(target, handler)
}
