import type { AnyObject, ArbitraryFunc } from "#type-declarations/tools"

import { len } from "./sundry"

export function isNull(v: any): v is null {
    return v === null
}

export function isSymbol(v: any): v is symbol {
    return typeof v == "symbol"
}

export function isNumber(v: any): v is number {
    return typeof v == "number"
}

export function isString(v: any): v is string {
    return typeof v == "string"
}

export function isEmptyString(v: any): v is "" {
    return v === ""
}

export function isBoolean(v: any): v is boolean {
    return typeof v == "boolean"
}

export function isObject(v: any): v is AnyObject {
    return v !== null && typeof v == "object"
}

export function isArray<T = any>(v: any): v is T[] {
    return Array.isArray(v)
}

export function isUndefined(v: any): v is undefined {
    return v === void 0
}

export function isFunction(v: any): v is ArbitraryFunc {
    return typeof v == "function"
}

export function isNonNegativeNumber(v: any): v is number {
    return isNumber(v) && v >= 0
}

export function isPromise<T = any>(v: any): v is Promise<T> {
    return isFunction(v?.then)
}

export function isNumberLike(v: any) {
    // @ts-expect-error: checks number-like
    return isNumber(v) ? true : isString(v) ? v == +v : false
}

export function isSpreadable(v: AnyObject) {
    const spreadable = v[Symbol.isConcatSpreadable]
    return isUndefined(spreadable) ? isArray(v) : !!spreadable
}

export function isArrayLike<T = any>(v: any): v is ArrayLike<T> {
    // @ts-expect-error: len() returns v.length
    return isArray(v) ? true : isObject(v) ? isNumber(len(v)) : false
}
