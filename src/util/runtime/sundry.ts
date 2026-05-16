import type { ObjectKeys } from "#type-declarations/tools"
import type { NextTickFunc, ToRawFunc } from "#type-declarations/runtime-ex"
import type { Destruction, ReactivityWrapper } from "#type-declarations/runtime"

import {
    WRAPPER,
    WRAPPER_MAP,
    WRAPPER_SET,
    REF_PROPERTY_ID
} from "../../runtime/reactivity/constants"
import { isRefProperty } from "./assert"
import { isFunction } from "../shared/assert"
import { any, notEqual } from "../shared/sundry"
import { constReact } from "../../runtime/internal"
import { FRAG_ORPHAN_CONTENT } from "../shared/flags"
import { NIL, RESOLVED } from "../../runtime/constants"
import { refProperties } from "../../runtime/reactivity/state"

export const toRaw: ToRawFunc = v => {
    const wrapper = any(v)?.[WRAPPER]
    return wrapper ? wrapper.r : v
}

export const nextTick: NextTickFunc = callback => {
    return isFunction(callback) ? RESOLVED.then(callback) : RESOLVED
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
    if (!notEqual(a, b)) {
        return false
    }

    const awrapper = a?.[WRAPPER]
    const bwrapper = b?.[WRAPPER]
    if (!awrapper) {
        return bwrapper ? notEqual(a, bwrapper.r) : notEqual(a, b)
    }
    if (!bwrapper) {
        return notEqual(awrapper.r, b)
    }
    return notEqual(awrapper.r, bwrapper.r)
}

export function getRawProperty(property: any) {
    return isRefProperty(property) ? property[1] : property
}

export function ensureGetRefProperty(property: ObjectKeys) {
    return getRefProperty(WRAPPER_SET, property)
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
    if (!destruction.s || !destruction.n) {
        return
    }
    if (destruction.f & FRAG_ORPHAN_CONTENT) {
        callback(destruction.s)
    } else {
        for (let node: ChildNode | null = destruction.s; node; ) {
            const current: ChildNode = node
            node = current === destruction.n ? NIL : current.nextSibling
            callback(current)
        }
    }
}
