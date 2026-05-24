import type { ArbitraryFunc, Getter } from "#type-declarations/tools"

import { REFERENCE_VALUE } from "./constants"
import { isFunction } from "../util/shared/assert"
import { newCleanObj } from "../util/shared/sundry"
import { defineProperties } from "../util/shared/aliases"

export function alias(getter: Getter) {
    return destructuringAlias(getter)[0]
}

// 待办：需要重构，使用 AliasedIdentifier 类代替，get => (参数 + path)，set => (参数 + path) = value
export const destructuringAlias = stripErrorStack((...getters: Getter[]) => {
    return getters.map(getter => {
        const accessor = newCleanObj()
        defineProperties(accessor, {
            [REFERENCE_VALUE]: {
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
