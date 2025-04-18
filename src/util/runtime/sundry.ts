import type { EventListenerFlagKeys, EventWrapperFlagKeys } from "../types"

import { isReactive } from "./assert"
import { RAW_VALUE } from "../../runtime/constants"
import { EventListenerFlag, EventWrapperFlag } from "../shared/flag"

// 获取原始值
export function getRawValue<T>(v: T) {
    return isReactive(v) ? v[RAW_VALUE] : v
}

// velf means Verify Event Listener Flag
export function velf(flag: number, key: EventListenerFlagKeys) {
    return (EventListenerFlag[key] & flag) === EventListenerFlag[key]
}

// vewf meas Verify Event Wrapper Flag
export function vewf(flag: number, key: EventWrapperFlagKeys) {
    return (EventWrapperFlag[key] & flag) === EventWrapperFlag[key]
}
