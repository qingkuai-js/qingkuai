import type { ArbitraryFunc, Getter, Setter, ZeroOrOne } from "#type-declarations/tools"
import type { Traversable, TraverseContext, TraverseInfo } from "#type-declarations/runtime"

import {
    TRAVERSE_SET,
    TRAVERSE_MAP,
    TRAVERSE_NUMBER,
    TRAVERSE_OBJECT,
    TRAVERSE_ARRAYLIKE
} from "./constants"
import { destroy } from "../destroy"
import { insertBefore } from "../dom"
import { NIL, REFLECT, UNDEF } from "../constants"
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
    let oldInfos: Record<string, TraverseInfo> = newCleanObj()

    renderEffect(() => {
        const oldLength = traversable?.l ?? 0
        traversable = normalizeTraversable(getValue())

        const newLength = traversable.l
        const newKeys: string[] = Array(newLength)
        const newInfos: Record<string, TraverseInfo> = newCleanObj()
        for (let i = 0; i < newLength; i++) {
            const newContext = getContext(traversable, i)
            const newKey = getKey(newContext.m, newContext.x)
            const oldKey = oldKeys[i] as string | undefined
            const oldInfoForNewKey = oldInfos[newKey] as TraverseInfo | undefined

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
                let setter: Setter | undefined = UNDEF
                const destruction = invokeRender(() => {
                    setter = render(reference, newContext)
                })
                newInfos[newKey] = {
                    s: setter,
                    c: newContext,
                    d: destruction
                }
            } else {
                if (oldKey != newKey) {
                    walkNodes(oldInfoForNewKey.d, node => {
                        insertBefore(reference, node)
                    })
                }
                newInfos[newKey] = oldInfoForNewKey
                updateBlock(oldInfoForNewKey, newContext)
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
    const infos: TraverseInfo[] = []

    renderEffect(() => {
        const oldLength = traversable?.l ?? 0
        traversable = normalizeTraversable(getValue())

        const newLength = traversable.l
        const updateLength = Math.min(oldLength, newLength)
        for (let i = 0; i < updateLength; i++) {
            updateBlock(infos[i], getContext(traversable, i))
        }
        for (let i = oldLength; i > newLength; i--) {
            destroy(infos.pop()!.d)
        }
        for (let i = oldLength; i < newLength; i++) {
            let setter: Setter | undefined = UNDEF
            const newContext = getContext(traversable, i)
            const destruction = invokeRender(() => {
                setter = render(newContext)
            })
            infos.push({
                s: setter,
                c: newContext,
                d: destruction
            })
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

function getContext(info: Traversable, index: number): TraverseContext {
    const get = (kind: ZeroOrOne) => {
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
    return { m: get(1), x: get(0) }
}

function updateBlock(oldInfo: TraverseInfo, newContext: TraverseContext) {
    const effect = oldInfo.d.e?.[0]
    if (
        effect &&
        !(effect.l & EFFECT_SCHEDULING) &&
        (reactiveNotEqual(oldInfo.c.m, newContext.m) || reactiveNotEqual(oldInfo.c.x, newContext.x))
    ) {
        oldInfo.s?.(newContext)
        oldInfo.c.m = newContext.m
        oldInfo.c.x = newContext.x
        runAndUpdateEffect(effect)
    }
}
