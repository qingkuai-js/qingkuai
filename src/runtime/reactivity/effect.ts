import type {
    Getter,
    Opportunity,
    WatchStruct,
    EffectStruct,
    EffectListItem,
    RuntimeWatchFunc,
    WatchEffectStruct
} from "../types"
import { GeneralFunc } from "../../util/types"

import { isNull } from "../../util/shared/assert"
import { opportunities, nil } from "../constants"
import { len, values } from "../../util/shared/sundry"
import { getRawValue } from "../../util/runtime/sundry"
import { asyncWatchEffectList, usedEffectList } from "./state"
import { WatchEffectDependenNoReactiveValue } from "../message/warn"

// 执行同步的effect，并将异步effect放入执行队列
export function runSyncEffect(list: EffectListItem[1]) {
    list?.forEach(item => {
        if (item.type === "sync") {
            runWatchEffect(item)
        } else {
            asyncWatchEffectList.add(item)
        }
    })
}

// 执行异步的watch和effect回调
export function flushWatchEffect(type: Opportunity) {
    asyncWatchEffectList.forEach(item => {
        if (item.type === type) {
            runWatchEffect(item)
            asyncWatchEffectList.delete(item)
        }
    })
}

// 执行单个watch相关的effect
function runWatchEffect(stu: WatchEffectStruct) {
    const isWatch = "cur" in stu
    if (!isWatch) {
        stu.fn()
    } else {
        const value = stu.getter()
        const raw = getRawValue(value)
        if (stu.cur === raw) {
            return
        }
        stu.fn(stu.cur, (stu.cur = raw))
    }
}

// 创建watch相关的effect
function createWatchEffect(effectList: EffectListItem[], stu: WatchEffectStruct) {
    effectList.forEach(item => {
        if (isNull(item[1])) {
            item[1] = new Set()
        }
        item[1].add(stu)
    })

    return () => {
        effectList.forEach(item => {
            item[1]!.delete(stu)
            if (item[1]!.size === 0) {
                item[1] = nil
            }
        })
    }
}

// 初始化watch相关运行时函数
function initWatch(getter: Getter, fn: WatchStruct["fn"], type: Opportunity) {
    const value = getter()
    const raw = getRawValue(value)
    const effectList = values(usedEffectList)
    const watchStruct: WatchStruct = {
        fn,
        type,
        getter,
        cur: raw
    }
    if (len(effectList) === 0) {
        const funcName = type === "post" ? "watch" : type + "Watch"
        WatchEffectDependenNoReactiveValue(funcName, false)
    }
    return createWatchEffect(effectList, watchStruct)
}

// 初始化reactiveRun相关运行时函数
function initEffect(fn: GeneralFunc, type: Opportunity, initEffectList?: EffectListItem[] | null) {
    let effectList: EffectListItem[]
    const isRuntime = isNull(initEffectList)
    const reactiveRunStruct: EffectStruct = {
        fn,
        type
    }
    if (initEffectList) {
        effectList = initEffectList
    } else {
        fn()
        effectList = values(usedEffectList)
    }
    if (isRuntime && len(effectList) === 0) {
        const funcName = type === "post" ? "effect" : type + "Effect"
        WatchEffectDependenNoReactiveValue(funcName, true)
    }
    return createWatchEffect(effectList, reactiveRunStruct)
}

// 产生watch相关运行时函数的方法
function watchFuncGen(type: Opportunity): RuntimeWatchFunc {
    return (target: any, callback: any) => {
        return initWatch(target, callback, type)
    }
}

// 产生effect相关运行时函数的方法，它返回的方法不接受初始副作用列表
function runtimeEffectFuncGen(type: Opportunity) {
    return (callback: () => void) => {
        return initEffect(callback, type, nil)
    }
}

// 产生effect相关内部函数的方法，它返回的方法可以接受初始副作用列表
function internalEffectFuncGen(type: Opportunity) {
    return (callback: GeneralFunc, initEffectList?: EffectListItem[]) => {
        return initEffect(callback, type, initEffectList)
    }
}

// prettier-ignore
export const [
    [syncWatch, preWatch, watch],
    [syncEffect, preEffect, effect],
    [internalSyncEffect, internalPreEffect, internalEffect]
] = [watchFuncGen, runtimeEffectFuncGen, internalEffectFuncGen].map<any>(generator => {
    return opportunities.map(opportunity => generator(opportunity))
}) as [RuntimeWatchFunc[], ReturnType<typeof runtimeEffectFuncGen>[], ReturnType<typeof internalEffectFuncGen>[]]
