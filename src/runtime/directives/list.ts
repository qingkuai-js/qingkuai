import type { Destruction, TraverseInfo } from "#type-declarations/runtime"
import type { ArbitraryFunc, Getter, ZeroOrOne } from "#type-declarations/tools"

import {
    LIST_KEY,
    LIST_VALUE,
    TRAVERSE_SET,
    TRAVERSE_NUMBER,
    TRAVERSE_OBJECT,
    TRAVERSE_ARRAYLIKE
} from "./constants"
import { destroy } from "../destroy"
import { insertBefore } from "../dom"
import { UNDEF, NIL, REFLECT } from "../constants"
import { len, optc } from "../../util/shared/sundry"
import { objectAssign } from "../../util/shared/aliases"
import { EFFECT_SCHEDULING } from "../reactivity/constants"
import { DuplicateKey, NonTraverse } from "../messages/error"
import { isArray, isNumber, isString } from "../../util/shared/assert"
import { renderEffect, runAndUpdateEffect } from "../reactivity/effect"
import { invokeRender, toRaw, walkNodes } from "../../util/runtime/sundry"

export function keyedListBlock(
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
        const newDestructions: Record<string, Destruction> = {}
        for (let i = 0, reference = anchor; i < newLength; i++) {
            const oldKey = oldKeys[i]
            const contextGetter = makeContextGetter(newInfo, i)
            const newKey = getKey(contextGetter)
            const destructionForNewKey = destructions[newKey]
            for (let j = i; j < oldLength; j++) {
                if (newDestructions[oldKeys[j]]) {
                    continue
                }
                reference = destructions[oldKeys[j]].n[0]!
            }
            if ((newKeys.push(newKey), !destructionForNewKey)) {
                if (newDestructions[newKey]) {
                    DuplicateKey(newKey)
                }
                newDestructions[newKey] = invokeRender(() => {
                    render(reference, contextGetter)
                })
            } else {
                if (oldKey != newKey) {
                    walkNodes(destructionForNewKey, node => {
                        insertBefore(reference, node)
                    })
                } else {
                    updateBlock(destructionForNewKey)
                }
                newDestructions[newKey] = destructionForNewKey
            }
        }
        for (let i = 0; i < oldLength; i++) {
            const oldKey = oldKeys[i]
            if (!newDestructions[oldKey]) {
                destroy(destructions[oldKey])
            }
        }
        oldKeys = newKeys
        objectAssign(info, newInfo)
        destructions = newDestructions
    })
}

export function listBlock(getValue: Getter, render: ArbitraryFunc) {
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
            updateBlock(destructions[i])
        }
        for (let i = oldLength; i > newLength; i--) {
            destroy(destructions.pop()!)
        }
        for (let i = oldLength; i < newLength; i++) {
            destructions.push(
                invokeRender(() => {
                    render(makeContextGetter(newInfo, i))
                })
            )
        }
        objectAssign(info, newInfo)
    })
}

function updateBlock(destruction: Destruction) {
    const effect = destruction.e![0]
    if (!(effect.l & EFFECT_SCHEDULING)) {
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
        info.l |= getItem ? LIST_VALUE : LIST_KEY
        return getContext(info, index, getItem, true)
    }
}

function getContext(info: TraverseInfo, index: number, getItem: ZeroOrOne = 1, track = false) {
    const currentKey = info.k?.[index]
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
