import type { ArbitraryFunc, Getter, Setter } from "#type-declarations/tools"

import { len, newCleanObj } from "../util/shared/sundry"
import { aliasSetterToTarget, aliasTargetDescriptors } from "./state"
import { defineProperties, getOwnPropertyDescriptor } from "../util/shared/aliases"

export function alias(getter: Getter, setter: Setter) {
    return destructuringAlias([getter], [setter])[0]
}

export const destructuringAlias = stripErrorStack((getters: Getter[], setters: Setter[]) => {
    const ret: any[] = []
    for (let i = 0; i < len(getters); i++) {
        const acceesor: any = {}
        const [target, key] = getters[i]()

        const set = (v: any) => {
            const [target, key] = getters[i]()
            target[key] = v
        }

        const get = () => {
            let container: any
            let originDescriptor: any
            const [target, key] = getters[i]()
            if (aliasTargetDescriptors.has(target)) {
                container = aliasTargetDescriptors.get(target)
            } else {
                aliasTargetDescriptors.set(target, (container = newCleanObj()))
            }
            if (!(originDescriptor = container[key])) {
                originDescriptor = container[key] = getOwnPropertyDescriptor(target, key)
                if (!aliasSetterToTarget.has(setters[i])) {
                    aliasSetterToTarget.set(setters[i], {
                        key,
                        target,
                        descriptor: originDescriptor
                    })
                } else {
                    const existing = aliasSetterToTarget.get(setters[i])
                    defineProperties(existing.target, { [existing.key]: existing.descriptor })
                }
            }
            defineProperties(target, {
                [key]: {
                    get() {
                        return originDescriptor.get?.() ?? originDescriptor.value
                    },
                    set(v) {
                        if ((setters[i](v), originDescriptor?.set)) {
                            originDescriptor.set(v)
                        } else {
                            originDescriptor.value = v
                        }
                    },
                    enumerable: originDescriptor.enumerable,
                    configurable: originDescriptor.configurable
                }
            })
            return (setters[i](target[key]), target[key])
        }

        defineProperties(acceesor, {
            $: {
                get: stripErrorStack(get),
                set: stripErrorStack(set)
            }
        })
        ret.push([acceesor, target[key]])
    }
    return ret
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
