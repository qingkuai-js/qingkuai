import type { Opportunity, Noop } from "./types"

export const NIL = null
export const UNDEF = void 0
export const REFLECT = Reflect
export const NOOP: Noop = () => {}

// configurations
export const EXPOSE_DEPENDECIES = false
export const EXPOSE_DESTRUCTIONS = false

// unique symbols
export const WRAPPER = Symbol()
export const IS_PROXY = Symbol()
export const RAW_VALUE = Symbol()
export const IS_MODULE_FUNC = Symbol()
export const INSTANTIATE_BY_H = Symbol()
export const IS_WITH_REFERENCE_RET = Symbol()

export const OPPORTUNITIES: Opportunity[] = ["sync", "pre", "post"]

// 以下常量更合适的表达是使用对象映射或enum，但为了压缩运行时编译体积而采用普通常量
export const ALIAS_MODULE_KIND = 1

export const BAD_TARGET_MOUNT_KIND = 1
export const BAD_TAEGET_DIRECTIVE_KIND = 2
