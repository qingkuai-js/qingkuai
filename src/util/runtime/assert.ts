import type {
    RefProperty,
    ProxyWrapper,
    ReactiveValue,
    ReactivityWrapper
} from "#type-declarations/runtime"
import type { AnyObject } from "#type-declarations/tools"

import {
    WRAPPER,
    WRAPPER_SET,
    WRAPPER_MAP,
    WRAPPER_ARRAY,
    WRAPPER_PROXY,
    REF_PROPERTY_ID,
    WRAPPER_SHALLOW
} from "../../runtime/reactivity/constants"
import { isObject } from "../shared/assert"

export function couldReact(value: any) {
    return !isReactive(value) && isObject(value)
}

export function isElement(v: any): v is Element {
    return v?.nodeType === 1
}

export function isShallow(wrapper: ReactivityWrapper) {
    return !!(wrapper.l & WRAPPER_SHALLOW)
}

export function isIteratorKey(wrapper: ReactivityWrapper, key: any) {
    if (wrapper.l & (WRAPPER_SET | WRAPPER_MAP)) {
        return !isRefProperty(key)
    }
    if (wrapper.l & WRAPPER_ARRAY) {
        switch (typeof key) {
            case "string": {
                key = +key
                // fallthrough
            }
            case "number": {
                return key >= 0
            }
        }
    }
    return false
}

export function isRefProperty(property: any): property is RefProperty {
    return property?.[0] === REF_PROPERTY_ID
}

export function isReactive<T extends AnyObject>(v: any): v is ReactiveValue<T> {
    return !!v?.[WRAPPER]
}

export function isProxyWrapper(wrapper: ReactivityWrapper): wrapper is ProxyWrapper {
    return !!(wrapper.l & WRAPPER_PROXY)
}
