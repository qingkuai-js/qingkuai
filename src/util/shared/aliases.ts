import type { ArbitraryFunc } from "#type-declarations/tools"

import { any } from "./sundry"
import { OBJECT } from "../../runtime/constants"

export function stringify(v: any) {
    return JSON.stringify(v)
}

export function reflectOwnKeys(o: any) {
    return Reflect.ownKeys(o)
}

export const objectKeys: typeof Object.keys = (o: any) => {
    return OBJECT.keys(o)
}

export function call(fn: ArbitraryFunc, caller: any, ...args: any) {
    return fn.call(caller, ...args)
}

export function apply(fn: ArbitraryFunc, caller: any, ...args: any) {
    return fn.apply(caller, args)
}

export const objectAssign: typeof Object.assign = (...args: any) => {
    return any(OBJECT.assign)(...args)
}

export const getPrototypeOf: typeof Object.getPrototypeOf = o => {
    return OBJECT.getPrototypeOf(o)
}

export const setPrototypeOf: typeof Object.setPrototypeOf = (o, proto) => {
    return OBJECT.setPrototypeOf(o, proto)
}

export const defineProperty: typeof Object.defineProperty = (o, p, attributes) => {
    return any(OBJECT.defineProperty)(o, p, attributes)
}

export const defineProperties: typeof Object.defineProperties = (o, properties) => {
    return any(OBJECT.defineProperties)(o, properties)
}

export const getOwnPropertyDescriptor: typeof Object.getOwnPropertyDescriptor = (o, p) => {
    return OBJECT.getOwnPropertyDescriptor(o, p)
}
