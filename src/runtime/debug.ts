import type { ArbitraryFunc, Getter } from "#type-declarations/tools"

import { REFERNECE_VALUE } from "./constants"
import { isFunction } from "../util/shared/assert"
import { newCleanObj } from "../util/shared/sundry"
import { defineProperties } from "../util/shared/aliases"

export function alias(getter: Getter) {
    return destructuringAlias(getter)[0]
}

export const destructuringAlias = stripErrorStack((...getters: Getter[]) => {
    return getters.map(getter => {
        const accessor = newCleanObj()
        defineProperties(accessor, {
            [REFERNECE_VALUE]: {
                get: stripErrorStack(() => {
                    const [target, key] = getter()
                    const ret = target[key]
                    if (isFunction(ret)) {
                        return ret.bind(target)
                    }
                    return ret
                }),
                set: stripErrorStack(value => {
                    const [target, key] = getter()
                    target[key] = value
                })
            }
        })
        return accessor
    })
})

function stripErrorStack<T extends ArbitraryFunc>(fn: T): T {
    const ret: any = (...args: any) => {
        try {
            return fn(...args)
        } catch (err: any) {
            throw (Error?.captureStackTrace(err, ret), err)
        }
    }
    return ret
}
