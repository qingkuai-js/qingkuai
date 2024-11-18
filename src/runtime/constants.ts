import type { Opportunity, Noop } from "./types"

export const nil = null
export const undef = void 0
export const reflect = Reflect
export const noop: Noop = () => {}

export const Wrapper = Symbol("Wrapper")
export const IsProxy = Symbol("IsProxy")
export const RawValue = Symbol("RawValue")
export const IsModuleFunc = Symbol("IsModuleFunc")
export const IntantiatedByH = Symbol("IntantiatedByH")
export const IsWithReferenceRet = Symbol("IsWithReferenceRet")

export const opportunities: Opportunity[] = ["sync", "pre", "post"]
