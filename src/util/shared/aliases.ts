import type { AnyObject } from "#type-declarations/tools"

import { any } from "./sundry"
import { OBJECT } from "../../runtime/constants"

export const objectKeys: typeof Object.keys = (o: AnyObject) => {
    return OBJECT.keys(o)
}

export const objectAssign: typeof Object.assign = (...args: any) => {
    return any(OBJECT.assign)(...args)
}

export const getPrototypeOf: typeof Object.getPrototypeOf = (o: any) => {
    return OBJECT.getPrototypeOf(o)
}

export const defineProperties: typeof Object.defineProperties = (...args: any) => {
    return any(OBJECT.defineProperties)(...args)
}

export const setPrototypeOf: typeof Object.setPrototypeOf = (o: any, proto: any) => {
    return OBJECT.setPrototypeOf(o, proto)
}
