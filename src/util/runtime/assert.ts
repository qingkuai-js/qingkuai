import type { AnyObject } from "../types"
import type { ModuleFunc } from "../../runtime/types"

import { QingKuaiComponent } from "../../runtime/instance"
import { IS_MODULE_FUNC, IS_PROXY, RAW_VALUE } from "../../runtime/constants"

export function isNode(v: any) {
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

export function isComponent(v: any) {
    return Object.getPrototypeOf(v) === QingKuaiComponent
}
