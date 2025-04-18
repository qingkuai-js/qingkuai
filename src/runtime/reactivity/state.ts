import type { GeneralFunc } from "../../util/types"
import type { EffectListItem, WatchEffectStruct } from "../types"

// 已被记录的effects集合
const usedEffectList = new Set<EffectListItem>()

// 等待执行的异步effect列表
const asyncWatchEffectList = new Set<WatchEffectStruct>()

export function cleanUsedEffectList() {
    usedEffectList.clear()
}

export function setUsedEffectList(lists: EffectListItem[]) {
    lists.forEach(list => {
        usedEffectList.add(list)
    })
}

// 前置调用cleanUsedEffectList方法的函数包装器
export function withCleanUsedEffectList<T extends GeneralFunc>(fn: T) {
    return (...args: Parameters<T>) => {
        cleanUsedEffectList()
        return fn(...args) as ReturnType<T>
    }
}

export { usedEffectList, asyncWatchEffectList }
