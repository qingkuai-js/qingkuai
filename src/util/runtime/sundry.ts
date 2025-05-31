import type { QingKuaiNodeStruct } from "../../runtime/types"
import type { EventListenerFlagKeys, EventWrapperFlagKeys } from "../types"

import { isReactive } from "./assert"
import { notEqual } from "../shared/sundry"
import { isArray, isSet } from "../shared/assert"
import { RAW_VALUE } from "../../runtime/constants"
import { EventListenerFlag, EventWrapperFlag } from "../shared/flag"

// 获取原始值
export function getRawValue<T>(v: T) {
    return isReactive(v) ? v[RAW_VALUE] : v
}

// 根据不同类型的选中项容器（select value、&group）生成检查是否被选中的方法
export function groupCheckerGen(container: any) {
    if (isArray(container) || isSet(container)) {
        return (v: any) => {
            for (const item of container.values()) {
                if (!notEqual(v, getRawValue(item))) {
                    return true
                }
            }
            return false
        }
    }
    if (isArray(container)) {
        return (v: any) => container.includes(v)
    }
    if (isSet(container)) {
        return (v: any) => container.has(v)
    }
    return (v: any) => !notEqual(container, v)
}

// velf means Verify Event Listener Flag
export function velf(flag: number, key: EventListenerFlagKeys) {
    return (EventListenerFlag[key] & flag) === EventListenerFlag[key]
}

// vewf meas Verify Event Wrapper Flag
export function vewf(flag: number, key: EventWrapperFlagKeys) {
    return (EventWrapperFlag[key] & flag) === EventWrapperFlag[key]
}

export function getValueFallback(qkNode: QingKuaiNodeStruct) {
    return "value" in qkNode.attrs ? qkNode.attrs.value : (qkNode as any).n.value
}
