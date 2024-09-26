import type { EffectListItem, GeneralFunc, Setter } from "../types"

import { internalSyncEffect } from "./effect"
import { IsProxy, reflect, undef } from "../constants"
import { len, values } from "../../util/shared/sundry"
import { isUndefined } from "../../util/shared/assert"
import { AssignmentToDerived, DerivedDependenNoReactiveValue } from "../message/warn"
import { setUsedEffectList, usedEffectList, withCleanUsedEffectList } from "./state"

// 注册衍生响应性状态
export const derived = withCleanUsedEffectList((fn: GeneralFunc, setter?: Setter) => {
    let init = true
    let dirty = true
    let effectList: EffectListItem[]

    const target = { $: undef as any }
    const isDebug = !isUndefined(setter)

    // 更新衍生响应性状态值
    const updateDerivedValue = () => {
        const value = fn && fn()
        if (isDebug) {
            setter(value)
        }
        target.$ = value
    }

    // 首次读取时进行初始化的方法
    const derivedInit = () => {
        init = false
        effectList = values(usedEffectList)
        if (len(effectList) === 0) {
            DerivedDependenNoReactiveValue()
        }
        internalSyncEffect(() => {
            dirty = true
        }, effectList)
    }

    const proxy = new Proxy<any>(target, {
        get(target, property) {
            if (property === IsProxy) {
                return true
            }
            if (dirty) {
                dirty = false
                updateDerivedValue()
            }
            if (init) {
                derivedInit()
            }
            setUsedEffectList(effectList)
            return reflect.get(target, property)
        },

        set() {
            return AssignmentToDerived(), true
        }
    })

    return isDebug ? [proxy, target.$] : proxy
})
