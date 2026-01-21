import type { Destruction, ReactivityWrapper } from "#type-declarations/runtime"
import type { AnyObject, ArbitraryFunc, GeneralFunc, ObjectKeys } from "#type-declarations/tools"

import {
    WRAPPER,
    WRAPPER_MAP,
    WRAPPER_SET,
    REF_PROPERTY_ID
} from "../../runtime/reactivity/constants"
import { isRefProperty } from "./assert"
import { isFunction } from "../shared/assert"
import { getSibling } from "../../runtime/dom"
import { any, notEqual } from "../shared/sundry"
import { setPrototypeOf } from "../shared/aliases"
import { constReact } from "../../runtime/internal"
import { NIL, RESOLVED } from "../../runtime/constants"
import { createDestruction } from "../../runtime/destroy"
import { backToParentDestruction } from "../../runtime/state"
import { refProperties } from "../../runtime/reactivity/state"

export function toRaw<T>(v: T): T {
    const wrapper = any(v)?.[WRAPPER]
    return wrapper ? wrapper.r : v
}

export function reverse(v: any) {
    const wrapper = v?.[WRAPPER]
    return wrapper ? wrapper.r : constReact(v)
}

export function walkWrapperChildren(
    wrapper: ReactivityWrapper,
    callback: (child: ReactivityWrapper) => boolean
) {
    if (!wrapper.c) {
        return
    }
    for (const child of wrapper.c) {
        if (callback(child)) {
            walkWrapperChildren(child, callback)
        }
    }
}

export function reactiveNotEqual(a: any, b: any) {
    const awrapper = a?.[WRAPPER]
    const bwrapper = b?.[WRAPPER]
    if (awrapper && bwrapper) {
        return notEqual(a, b)
    }
    if (awrapper) {
        a = awrapper.r
    }
    if (bwrapper) {
        b = bwrapper.r
    }
    return notEqual(a, b)
}

export function nextTick(fn?: ArbitraryFunc) {
    return isFunction(fn) ? RESOLVED.then(fn) : RESOLVED
}

export function getRawProperty(property: any) {
    return isRefProperty(property) ? property[1] : property
}

export function invokeRender(render: GeneralFunc) {
    const destruction = createDestruction()
    return render(), backToParentDestruction(), destruction
}

export function ensureGetRefProperty(property: ObjectKeys) {
    return getRefProperty(WRAPPER_SET, property)
}

export function stripPrototype<T extends AnyObject>(o: T): T {
    return setPrototypeOf(o, NIL), o
}

export function getRefProperty(wrapperFlag: number, property: ObjectKeys) {
    if (!(wrapperFlag & (WRAPPER_SET | WRAPPER_MAP))) {
        return property
    }

    let result: unknown[] | undefined
    if (!(result = refProperties.get(property))) {
        result = [REF_PROPERTY_ID, property]
        refProperties.set(property, result)
    }
    return result
}

export function walkNodes(destruction: Destruction, callback: (node: ChildNode) => void) {
    let start = destruction.n[0]
    if (start) {
        const end = getSibling(destruction.n[1]!)
        while (start && start !== end) {
            callback(start)
            start = getSibling(start)
        }
    }
}
