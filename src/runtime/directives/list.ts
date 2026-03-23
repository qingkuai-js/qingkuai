import type {
    Destruction,
    Traversable,
    TraverseContext,
    KeyedTraverseInfo
} from "#type-declarations/runtime"
import type { ArbitraryFunc, Getter, ZeroOrOne } from "#type-declarations/tools"

import {
    TRAVERSE_SET,
    TRAVERSE_MAP,
    TRAVERSE_NUMBER,
    TRAVERSE_OBJECT,
    TRAVERSE_ARRAYLIKE
} from "./constants"
import { destroy } from "../destroy"
import { insertBefore } from "../dom"
import { NIL, REFLECT } from "../constants"
import { arrayFrom } from "../../util/shared/arrays"
import { EFFECT_SCHEDULING } from "../reactivity/constants"
import { reactiveNotEqual } from "../../util/runtime/sundry"
import { DuplicateKey, NonTraverse } from "../messages/error"
import { len, newCleanObj, optc } from "../../util/shared/sundry"
import { invokeRender, walkNodes } from "../../util/runtime/sundry"
import { isArray, isNumber, isString } from "../../util/shared/assert"
import { renderEffect, runAndUpdateEffect } from "../reactivity/effect"

export function keyedListBlock(
    anchor: ChildNode,
    getValue: Getter,
    getKey: ArbitraryFunc,
    render: ArbitraryFunc
) {
    let oldKeys: string[] = []
    let traversable!: Traversable
    let oldInfos: Record<string, KeyedTraverseInfo> = newCleanObj()

    renderEffect(() => {
        const oldLength = traversable?.l ?? 0
        traversable = normalizeTraversable(getValue())

        const newLength = traversable.l
        const newKeys: string[] = Array(newLength)
        const newInfos: Record<string, KeyedTraverseInfo> = newCleanObj()
        for (let i = 0; i < newLength; i++) {
            const newContext: TraverseContext = {
                x: getContext(traversable, i, 0),
                m: getContext(traversable, i, 1)
            }
            const newKey = getKey(newContext.m, newContext.x)
            const oldKey = oldKeys[i] as string | undefined
            const oldInfoForNewKey = oldInfos[newKey] as KeyedTraverseInfo | undefined

            let reference = anchor
            for (let j = i; j < oldLength; j++) {
                if (newInfos[oldKeys[j]]) {
                    continue
                }
                reference = oldInfos[oldKeys[j]]!.d.n[0]!
                break
            }
            if (newInfos[newKey]) {
                DuplicateKey(newKey)
            }
            newKeys[i] = newKey

            if (!oldInfoForNewKey) {
                newInfos[newKey] = {
                    c: newContext,
                    d: invokeRender(() => {
                        render(reference, newContext)
                    })
                }
            } else {
                if (oldKey != newKey) {
                    walkNodes(oldInfoForNewKey.d, node => {
                        insertBefore(reference, node)
                    })
                }
                newInfos[newKey] = {
                    c: newContext,
                    d: oldInfoForNewKey.d
                }
                updateBlock(oldInfoForNewKey.d, oldInfoForNewKey.c, newContext)
            }
        }
        for (let i = 0; i < oldLength; i++) {
            if (!newInfos[oldKeys[i]]) {
                destroy(oldInfos[oldKeys[i]].d)
            }
        }
        oldKeys = newKeys
        oldInfos = newInfos
    })
}

export function listBlock(getValue: Getter, render: ArbitraryFunc) {
    let traversable!: Traversable
    const contexts: TraverseContext[] = []
    const destructions: Destruction[] = []

    renderEffect(() => {
        const oldLength = traversable?.l ?? 0
        traversable = normalizeTraversable(getValue())

        const newLength = traversable.l
        const updateLength = Math.min(oldLength, newLength)
        for (let i = 0; i < updateLength; i++) {
            const oldContext = contexts[i]
            const newContext: TraverseContext = {
                x: getContext(traversable, i, 0),
                m: getContext(traversable, i, 1)
            }
            contexts[i] = newContext
            updateBlock(destructions[i], oldContext, newContext)
        }
        for (let i = oldLength; i > newLength; i--) {
            contexts.pop()
            destroy(destructions.pop()!)
        }
        for (let i = oldLength; i < newLength; i++) {
            const newContext: TraverseContext = {
                x: getContext(traversable, i, 0),
                m: getContext(traversable, i, 1)
            }
            destructions.push(
                invokeRender(() => {
                    render(newContext)
                })
            )
            contexts.push(newContext)
        }
    })
}

function normalizeTraversable(value: any): Traversable {
    const ret: Traversable = {
        l: 0,
        t: 0,
        k: NIL,
        v: value
    }
    if (isNumber(value)) {
        ret.t = TRAVERSE_NUMBER
        return ret
    }
    if (isArray(value) || isString(value)) {
        ret.l = len(value)
        ret.t = TRAVERSE_ARRAYLIKE
        return ret
    }

    switch (optc(value)) {
        case "Set": {
            ret.l = value.size
            ret.t = TRAVERSE_SET
            ret.k = arrayFrom(value.keys())
            return ret
        }
        case "Map": {
            ret.l = value.size
            ret.t = TRAVERSE_MAP
            ret.k = arrayFrom(value.keys())
            return ret
        }
        case "Object": {
            ret.t = TRAVERSE_OBJECT
            ret.l = len((ret.k = REFLECT.ownKeys(value)))
            return ret
        }
    }
    return NonTraverse()
}

// kind: 0 for get key, 1 for get value
function getContext(info: Traversable, index: number, kind: ZeroOrOne) {
    const currentKey = info.k?.[index]
    switch (info.t) {
        case TRAVERSE_SET: {
            return currentKey
        }
        case TRAVERSE_NUMBER: {
            return index + kind
        }
        case TRAVERSE_ARRAYLIKE: {
            return kind ? info.v[index] : index
        }
        case TRAVERSE_OBJECT: {
            return kind ? info.v[currentKey] : currentKey
        }
        default: {
            return kind ? info.v.get(currentKey) : currentKey
        }
    }
}

function updateBlock(
    destruction: Destruction,
    oldContext: TraverseContext,
    context: TraverseContext
) {
    const effect = destruction.e![0]

    if (
        !(effect.l & EFFECT_SCHEDULING) &&
        (reactiveNotEqual(oldContext.m, context.m) || reactiveNotEqual(oldContext.x, context.x))
    ) {
        oldContext.m = context.m
        oldContext.x = context.x
        runAndUpdateEffect(effect)
    }
}
