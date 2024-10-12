import type { AnyObject } from "../types"
import type { ModuleFunc } from "../../runtime/types"

import { isNumber } from "../shared/assert"
import { IsModuleFunc, IsProxy, RawValue } from "../../runtime/constants"

// 判断是否DOM节点
export function isNode(v: any): v is Node {
    return isNumber(v.nodeType)
}

// 判断值是否为响应式值
export function isReactive<T extends AnyObject>(
    v: any
): v is T & {
    [RawValue]: T
} {
    return v?.[IsProxy] === true
}

// 判断是否是ModuleFunc类型
export function isModuleFunc(v: any): v is ModuleFunc {
    return !!v?.[IsModuleFunc]
}
