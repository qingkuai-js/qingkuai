import type { EffectListItem, WatchEffectStruct } from "../types"

// 已被记录的effects集合
const usedEffectList = new Set<EffectListItem>()

// 等待执行的异步effect列表
const asyncWatchEffectList = new Set<WatchEffectStruct>()

export function clearUsedEffectList() {
    usedEffectList.clear()
}

export function setUsedEffectList(lists: EffectListItem[]) {
    lists.forEach(list => {
        usedEffectList.add(list)
    })
}

// 前置调用clearUsedReactivityWrapper方法的函数包装器，此方法会开启记录usedEffectList
// 传入的方法结束后会关闭usedEffectList的记录
export function withCleanUsedEffectList<T extends (...ps: any[]) => any>(fn: T) {
    const funcWithCleanEffect = (...args: Parameters<T>) => {
        clearUsedEffectList()
        return fn(...args) as ReturnType<T>
    }
    return funcWithCleanEffect
}

export { usedEffectList, asyncWatchEffectList }
