import type { ArbitraryFunc } from "#type-declarations/tools";

import { OBJECT } from "../../runtime/constants";

export function stringify(v: any) {
    return JSON.stringify(v);
}

export function reflectOwnKeys(o: any) {
    return Reflect.ownKeys(o);
}

export const objectKeys: typeof Object.keys = (o: any) => {
    return OBJECT.keys(o);
};

export const objectCreate: typeof Object.create = (o: any) => {
    return OBJECT.create(o);
};

export function call(fn: ArbitraryFunc, caller: any, ...args: any) {
    return fn.call(caller, ...args);
}

export function apply(fn: ArbitraryFunc, caller: any, ...args: any) {
    return fn.apply(caller, args);
}

export const objectAssign: typeof Object.assign = (...args: any) => {
    return (OBJECT.assign as any)(...args);
};

export const getPrototypeOf: typeof Object.getPrototypeOf = o => {
    return OBJECT.getPrototypeOf(o);
};

export const setPrototypeOf: typeof Object.setPrototypeOf = (o, proto) => {
    return OBJECT.setPrototypeOf(o, proto);
};

export const defineProperty: typeof Object.defineProperty = (o, p, attributes) => {
    return (OBJECT.defineProperty as any)(o, p, attributes);
};

export const defineProperties: typeof Object.defineProperties = (o, properties) => {
    return (OBJECT.defineProperties as any)(o, properties);
};

export const getOwnPropertyDescriptor: typeof Object.getOwnPropertyDescriptor = (o, p) => {
    return OBJECT.getOwnPropertyDescriptor(o, p);
};
