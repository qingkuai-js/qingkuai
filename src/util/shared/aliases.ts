import { any } from "./sundry"
import { OBJECT } from "../../runtime/constants"

export function stringify(v: any) {
    return JSON.stringify(v)
}

export const objectKeys: typeof Object.keys = (o: any) => {
    return OBJECT.keys(o)
}

export const objectAssign: typeof Object.assign = (...args: any) => {
    return any(OBJECT.assign)(...args)
}

export const getPrototypeOf: typeof Object.getPrototypeOf = (o: any) => {
    return OBJECT.getPrototypeOf(o)
}

export const getOwnPropertyDescriptor: typeof Object.getOwnPropertyDescriptor = (
    o: any,
    p: any
) => {
    return OBJECT.getOwnPropertyDescriptor(o, p)
}

export const setPrototypeOf: typeof Object.setPrototypeOf = (o: any, proto: any) => {
    return OBJECT.setPrototypeOf(o, proto)
}

export const defineProperties: typeof Object.defineProperties = (o: any, properties: any) => {
    return any(OBJECT.defineProperties)(o, properties)
}
