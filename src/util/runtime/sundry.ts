import type { EventListenerFlagKeys, EventWrapperFlagKeys } from "../types"

import { isReactive } from "./assert"
import { RawValue } from "../../runtime/constants"
import { EventListenerFlag, EventWrapperFlag } from "../shared/flag"

// 获取原始值
export function getRawValue<T>(v: T) {
    return isReactive(v) ? v[RawValue] : v
}

// 通过指定元素删除数组中对应的元素（只会删除第一个匹配项）
export function spliceByElem<T>(arr: T[], elem: T) {
    const index = arr.indexOf(elem)
    if (index !== -1) {
        arr.splice(index, 1)
    }
}

// velf means Verify Event Listener Flag
export function velf(flag: number, key: EventListenerFlagKeys) {
    return !!(EventListenerFlag[key] & flag)
}

// vewf meas Verify Event Wrapper Flag
export function vewf(flag: number, key: EventWrapperFlagKeys) {
    return !!(EventWrapperFlag[key] & flag)
}
