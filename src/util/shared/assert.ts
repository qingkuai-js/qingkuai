import type { AnyObject } from "../types"

import { optc } from "../shared/sundry"

export function isNull(v: any): v is null {
    return v === null
}

export function isNaN(v: any): v is Number {
    return Number.isNaN(v)
}

export function isArray(v: any): v is any[] {
    return Array.isArray(v)
}

export function isSymbol(v: any): v is symbol {
    return typeof v === "symbol"
}

export function isNumber(v: any): v is number {
    return typeof v === "number"
}

export function isString(v: any): v is string {
    return typeof v === "string"
}

export function isEmptyString(v: any): v is "" {
    return v === ""
}

export function isBoolean(v: any): v is boolean {
    return typeof v === "boolean"
}

export function isObject(v: any): v is AnyObject {
    return optc(v) === "Object"
}

export function isFunction(v: any): v is Function {
    return typeof v === "function"
}

export function isUndefined(v: any): v is undefined {
    return v === void 0
}
