import type { ArbitraryFunc, Getter } from "#type-declarations/tools"

import { REFERENCE_VALUE } from "./constants"
import { isFunction } from "../util/shared/assert"
import { newCleanObj } from "../util/shared/sundry"
import { defineProperties } from "../util/shared/aliases"

export function alias(getter: Getter) {
    return destructuringAlias(getter)[0]
}

// 别名访问器在每次构造时才包装栈信息，模块作用域因此只保留纯函数声明：
// 不使用该能力的应用可以把整个模块（连同 stripErrorStack）摇掉。
// The alias accessors are wrapped lazily when they are constructed, so the module
// scope only holds pure function declarations and applications that never use this
// capability can tree-shake the whole module (including `stripErrorStack`) away.
export const destructuringAlias = (...getters: Getter[]) => {
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
}

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
