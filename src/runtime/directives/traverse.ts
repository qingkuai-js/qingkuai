import type { ArbitraryFunc, Getter, ZeroOrOne } from "#type-declarations/tools"
import type { Destruction, TraverseInfo } from "#type-declarations/runtime"

import {
    TRAVERSE_KEY,
    TRAVERSE_VALUE,
    TRAVERSE_SET,
    TRAVERSE_NUMBER,
    TRAVERSE_OBJECT,
    TRAVERSE_ARRAYLIKE
} from "./constants"
import { insertBefore } from "../dom"
import { mutualLink } from "../reactivity/value"
import { UNDEF, NIL, REFLECT } from "../constants"
import { isReactive } from "../../util/runtime/assert"
import { createDestruction, destroy } from "../destroy"
import { objectAssign } from "../../util/shared/aliases"
import { toRaw, walkNodes } from "../../util/runtime/sundry"
import { DuplicateKey, NonTraverse } from "../messages/error"
import { len, notEqual, optc } from "../../util/shared/sundry"
import { isArray, isNumber, isString } from "../../util/shared/assert"
import { renderEffect, runAndUpdateEffect } from "../reactivity/effect"
import { WRAPPER, ITERATOR_KEYS, EFFECT_SCHEDULING } from "../reactivity/constants"

export function keyedTraverseBlock(
    anchor: ChildNode,
    getValue: Getter,
    getKey: ArbitraryFunc,
    render: ArbitraryFunc
) {
    const info: TraverseInfo = {
        l: 0,
        t: 0,
        h: 0,
        k: NIL,
        v: UNDEF
    }

    let oldKeys: string[] = []
    let destructions: Record<string, Destruction> = {}

    renderEffect(() => {
        const baseValue = getValue()
        const newInfo = getTraverseInfo(baseValue)
        const oldLength = info.h
        const newLength = newInfo.h
        const newKeys: string[] = []
        const checkLength = Math.max(info.h, newInfo.h)
        const newDestructions: Record<string, Destruction> = {}
        if (isReactive(baseValue) && isArray(baseValue)) {
            mutualLink(baseValue[WRAPPER], ITERATOR_KEYS)
        }
        for (let i = 0, destructionForNewKey: Destruction | undefined; i < checkLength; i++) {
            const oldKey = oldKeys[i]
            if (i >= newLength) {
                if (!newDestructions[oldKey]) {
                    destroy(destructions[oldKey])
                }
                continue
            }

            // 此时一定有 oldLength <= newLength
            // At this point, it is guaranteed that oldLength <= newLength.
            const reference = i < oldLength ? destructions[oldKey].n[0]! : anchor
            const newKey = getKey(getContext(newInfo, i), getContext(newInfo, i, 0))
            if (!(destructionForNewKey = destructions[newKey])) {
                if (newDestructions[newKey]) {
                    DuplicateKey(newKey)
                }
                newDestructions[newKey] = createDestruction()
                render(reference, makeContextGetter(info, i))
            } else {
                if (oldKey != newKey) {
                    walkNodes(destructionForNewKey, node => {
                        insertBefore(reference, node)
                    })
                } else {
                    updateBlock(i, info, newInfo, destructionForNewKey)
                }
                newDestructions[newKey] = destructionForNewKey
            }
        }
        oldKeys = newKeys
        objectAssign(info, newInfo)
        destructions = newDestructions
    })
}

export function traverseBlock(getValue: Getter, render: ArbitraryFunc) {
    const info: TraverseInfo = {
        l: 0,
        h: 0,
        t: 0,
        k: NIL,
        v: UNDEF
    }
    const destructions: Destruction[] = []

    renderEffect(() => {
        const newInfo = getTraverseInfo(getValue())
        const oldLength = info.h
        const newLength = newInfo.h
        const updateLength = Math.min(oldLength, newLength)
        for (let i = 0; i < updateLength; i++) {
            updateBlock(i, info, newInfo, destructions[i])
        }
        for (let i = oldLength; i > newLength; i--) {
            destroy(destructions.pop()!)
        }
        for (let i = oldLength; i < newLength; i++) {
            destructions.push(createDestruction())
            render(makeContextGetter(info, i))
        }
        objectAssign(info, newInfo)
    })
}

function updateBlock(
    index: number,
    oldInfo: TraverseInfo,
    newInfo: TraverseInfo,
    destruction: Destruction
) {
    const effect = destruction.e![0]
    if (!oldInfo.l || effect.l & EFFECT_SCHEDULING) {
        return
    }
    if (
        notEqual(getContext(oldInfo, index), getContext(newInfo, index)) ||
        notEqual(getContext(oldInfo, index, 0), getContext(newInfo, index, 0))
    ) {
        runAndUpdateEffect(effect)
    }
}

function getTraverseInfo(value: any): TraverseInfo {
    const ret: TraverseInfo = {
        l: 0,
        h: 0,
        t: 0,
        k: NIL,
        v: value
    }
    if (isNumber(value)) {
        ret.t = TRAVERSE_NUMBER
        ret.h = value
        return ret
    }
    if (isArray(value) || isString(value)) {
        ret.t = TRAVERSE_ARRAYLIKE
        ret.h = len(value)
        return ret
    }

    switch (optc(value)) {
        case "Set": {
            ret.t = TRAVERSE_SET
            // fallthrough
        }
        case "Map": {
            ret.h = len((ret.k = value.keys()))
            return ret
        }
        case "Object": {
            ret.h = len((ret.k = REFLECT.ownKeys(value)))
            ret.t = TRAVERSE_OBJECT
            return ret
        }
    }
    return NonTraverse()
}

function makeContextGetter(info: TraverseInfo, index: number) {
    return (getItem: ZeroOrOne = 1) => {
        info.l |= getItem ? TRAVERSE_VALUE : TRAVERSE_KEY
        return getContext(info, index, getItem, true)
    }
}

function getContext(info: TraverseInfo, index: number, getItem: ZeroOrOne = 1, track = false) {
    const currentKey = info.k![index]
    const value = track ? info.v : toRaw(info.v)
    switch (info.t) {
        case TRAVERSE_NUMBER: {
            return index + getItem
        }
        case TRAVERSE_SET: {
            return currentKey
        }
        case TRAVERSE_ARRAYLIKE: {
            return getItem ? value[index] : index
        }
        case TRAVERSE_OBJECT: {
            return getItem ? value[currentKey] : currentKey
        }
        default: {
            return getItem ? value.get(currentKey) : currentKey
        }
    }
}
