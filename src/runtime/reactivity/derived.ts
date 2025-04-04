import type {
    Setter,
    Getter,
    DerivedTarget,
    DestructuringFunc,
    DerivedInternalState
} from "../types"
import type { GeneralFunc } from "../../util/types"

import { internalSyncEffect } from "./effect"
import { len, values } from "../../util/shared/sundry"
import { isUndefined } from "../../util/shared/assert"
import { IS_PROXY, REFLECT, UNDEF } from "../constants"
import { setUsedEffectList, usedEffectList, withCleanUsedEffectList } from "./state"
import { AssignmentToDerived, DerivedDependenNoReactiveValue } from "../message/warn"

// 注册衍生响应性状态
export const derived = withCleanUsedEffectList((fn: Getter, setter?: Setter) => {
    const state = newDerivedState()
    const target = newDerivedTarget()
    const isDebug = !isUndefined(setter)

    // 更新衍生响应性状态值
    const update = () => {
        const value = fn()
        if (isDebug) {
            setter(value)
        }
        target.$ = value
    }
    const proxy = newDerivedProxy(target, state, update)

    return isDebug ? [proxy, proxy.$] : proxy
})

// 解构注册衍生响应性状态：将解构的每个标识符单独声明为一个衍生响应性状态，被解构
// 出来的多个衍生响应性状态共享同一个副作用，会避免在访问不同值时重复调用getter
export const destructuringDerived = withCleanUsedEffectList(
    (dfnAndSetters: [DestructuringFunc, number, ...Setter[]], fn: Getter) => {
        const ret: any[] = []
        const state = newDerivedState()
        const isDebug = !isUndefined(dfnAndSetters[2])
        const [destructuringFunc, valuesLen, ...setters] = dfnAndSetters
        const targets = Array.from({ length: valuesLen }, newDerivedTarget)

        // 更新衍生响应性状态值
        const update = () => {
            const values = destructuringFunc(fn())
            for (let i = 0; i < valuesLen; i++) {
                if (isDebug) {
                    setters[i](values[i])
                }
                targets[i].$ = values[i]
            }
        }

        for (let i = 0; i < valuesLen; i++) {
            const proxy = newDerivedProxy(targets[i], state, update)
            ret.push(isDebug ? [proxy, proxy.$] : proxy)
        }

        return ret
    }
)

function newDerivedTarget(): DerivedTarget {
    return { $: UNDEF as any }
}

function newDerivedState(): DerivedInternalState {
    return {
        dirty: true,
        effectList: [],
        initialized: false
    }
}

function newDerivedProxy(target: DerivedTarget, state: DerivedInternalState, udpate: GeneralFunc) {
    return new Proxy<any>(target, {
        get(target, property, receiver) {
            if (property === IS_PROXY) {
                return true
            }
            if (state.dirty) {
                udpate()
                state.dirty = false
            }
            if (!state.initialized) {
                state.effectList = values(usedEffectList)
                if (len(state.effectList) === 0) {
                    DerivedDependenNoReactiveValue()
                }
                state.initialized = true
                internalSyncEffect(() => {
                    state.dirty = true
                }, state.effectList)
            }
            setUsedEffectList(state.effectList)
            return REFLECT.get(target, property, receiver)
        },

        set() {
            return AssignmentToDerived(), true
        }
    })
}
