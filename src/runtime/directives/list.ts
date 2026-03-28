import type {
    Effect,
    Destruction,
    Traversable,
    TraverseInfo,
    TraverseContext
} from "#type-declarations/runtime"
import type { ArbitraryFunc, Getter, Setter } from "#type-declarations/tools"

import {
    TRAVERSE_SET,
    TRAVERSE_MAP,
    TRAVERSE_NUMBER,
    TRAVERSE_OBJECT,
    TRAVERSE_ARRAYLIKE
} from "./constants"
import { destroy } from "../destroy"
import { appendChild, insertBefore } from "../dom"
import { arrayFrom } from "../../util/shared/arrays"
import { EFFECT_SCHEDULING } from "../reactivity/constants"
import { reactiveNotEqual } from "../../util/runtime/sundry"
import { newCleanObj, optc } from "../../util/shared/sundry"
import { DuplicateKey, NonTraverse } from "../messages/error"
import { FRAGMENT_FLAG, NIL, REFLECT, UNDEF } from "../constants"
import { invokeRender, walkNodes } from "../../util/runtime/sundry"
import { isArray, isNumber, isString } from "../../util/shared/assert"
import { renderEffect, runAndUpdateEffect } from "../reactivity/effect"
import { FRAG_ORPHAN_CONTENT, FRAG_WHOLE_CONTENT } from "../../util/shared/flags"

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
        const wholeContent = oldLength && isWholeContentDestruction(oldInfos[oldKeys[0]].d)
        const detachWhole = !!(wholeContent && newLength === 0)
        for (let i = 0; i < newLength; i++) {
            const newContext = getContext(traversable, i)
            const newKey = "" + getKey(newContext.m, newContext.x)

            newKeys[i] = newKey
            if (newInfos[newKey]) {
                DuplicateKey(newKey)
            }

            const oldInfoForNewKey = oldInfos[newKey]
            if (!oldInfoForNewKey) {
                newInfos[newKey] = {
                    d: NIL,
                    s: NIL,
                    c: newContext
                } as any
            } else {
                newInfos[newKey] = oldInfoForNewKey
            }
        }

        let start = 0
        let oldEnd = oldLength - 1
        let newEnd = newLength - 1
        for (; start < oldLength && start < newLength; start++) {
            const oldKey = oldKeys[start]
            const newKey = newKeys[start]
            if (oldKey !== newKey) {
                break
            }
            updateBlock(oldInfos[oldKey], traversable, start)
        }
        for (; oldEnd >= start && newEnd >= start; oldEnd--, newEnd--) {
            const oldKey = oldKeys[oldEnd]
            const newKey = newKeys[newEnd]
            if (oldKey !== newKey) {
                break
            }
            updateBlock(oldInfos[oldKey], traversable, newEnd)
        }

        for (let i = newEnd; i >= start; i--) {
            const oldKey = oldKeys[i]
            const newKey = newKeys[i]
            const oldInfo = oldInfos[oldKey]
            const newInfo = newInfos[newKey]
            if (oldKey === newKey) {
                updateBlock(oldInfo, traversable, i)
                continue
            }

            let reference = anchor
            if (i < newLength - 1) {
                reference = getFirstNodeOfDestruction(newInfos[newKeys[i + 1]].d) ?? anchor
            }
            if (newInfo.d) {
                walkNodes(newInfo.d, node => {
                    insertBefore(reference, node)
                })
                updateBlock(newInfo, traversable, i)
            } else {
                newInfo.d = invokeRender(() => {
                    newInfo.s = render(reference, newInfo.c)
                })
            }
        }

        for (let i = start, nodesDetached = false; i <= oldEnd; i++) {
            const oldKey = oldKeys[i]
            if (newInfos[oldKey]) {
                continue
            }

            const destruction = oldInfos[oldKey].d
            if (detachWhole && !nodesDetached) {
                detachWholeContent(destruction)
                nodesDetached = true
            }
            destroy(destruction, !nodesDetached)
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
        const wholeContent = oldLength && isWholeContentDestruction(infos[0].d)
        const detachWhole = !!(wholeContent && newLength === 0)
        for (let i = 0; i < updateLength; i++) {
            updateBlock(infos[i], traversable, i)
        }
        for (let i = oldLength, nodesDetached = false; i > newLength; i--) {
            const destruction = infos.pop()!.d
            if (detachWhole && !nodesDetached) {
                detachWholeContent(destruction)
                nodesDetached = true
            }
            destroy(destruction, !nodesDetached)
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
        ret.l = value.length
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
            ret.l = (ret.k = REFLECT.ownKeys(value)).length
            return ret
        }
    }
    return NonTraverse()
}

function detachWholeContent(destruction: Destruction) {
    const parent = destruction.r!.parentElement!
    const anchor = parent.lastChild!
    parent.textContent = ""
    appendChild(parent, anchor)
}

function getFirstNodeOfDestruction(destruction: Destruction) {
    if (!destruction.r) {
        return NIL
    }
    if (destruction.r[FRAGMENT_FLAG] & FRAG_ORPHAN_CONTENT) {
        return destruction.r as ChildNode
    }
    return destruction.r.firstChild as ChildNode
}

function isWholeContentDestruction(destruction: Destruction) {
    return !!((destruction.r?.[FRAGMENT_FLAG] ?? 0) & FRAG_WHOLE_CONTENT)
}

function getContext(traversable: Traversable, index: number): TraverseContext {
    const context: TraverseContext = { m: NIL, x: NIL }
    return (fillContext(traversable, index, context), context)
}

function updateBlock(oldInfo: TraverseInfo, traversable: Traversable, index: number) {
    const context = oldInfo.c
    const oldM = context.m
    const oldX = context.x
    fillContext(traversable, index, context)

    if (reactiveNotEqual(oldM, context.m) || reactiveNotEqual(oldX, context.x)) {
        oldInfo.s?.(context)

        const effect = oldInfo.d.e?.[0] as Effect | undefined
        if (effect && !(effect.l & EFFECT_SCHEDULING)) {
            runAndUpdateEffect(effect)
        }
    }
}

function fillContext(traversable: Traversable, index: number, context: TraverseContext) {
    switch (traversable.t) {
        case TRAVERSE_SET: {
            const key = traversable.k?.[index]
            context.x = key
            context.m = key
            return
        }
        case TRAVERSE_NUMBER: {
            context.x = index
            context.m = index + 1
            return
        }
        case TRAVERSE_ARRAYLIKE: {
            context.x = index
            context.m = traversable.v[index]
            return
        }
        case TRAVERSE_OBJECT: {
            const key = traversable.k?.[index]
            context.x = key
            context.m = traversable.v[key]
            return
        }
        case TRAVERSE_MAP: {
            const key = traversable.k?.[index]
            context.x = key
            context.m = traversable.v.get(key)
            return
        }
    }
    context.x = context.m = NIL
}
