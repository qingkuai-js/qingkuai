import type { AnyObject } from "../types"
import type { ModuleFunc } from "../../runtime/types"

import { isNumber } from "../shared/assert"
import { IS_MODULE_FUNC, IS_PROXY, RAW_VALUE } from "../../runtime/constants"

// 判断是否DOM节点
export function isNode(v: any): v is Node {
    return v instanceof Node
}

// 判断值是否为响应式值
export function isReactive<T extends AnyObject>(
    v: any
): v is T & {
    [RAW_VALUE]: T
} {
    return v?.[IS_PROXY] === true
}

// 判断是否是ModuleFunc类型
export function isModuleFunc(v: any): v is ModuleFunc {
    return !!v?.[IS_MODULE_FUNC]
}
