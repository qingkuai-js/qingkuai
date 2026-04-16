import type {
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
import { NIL, REFLECT, UNDEF } from "../constants"
import { appendChild, insertBefore } from "../dom"
import { arrayFrom } from "../../util/shared/arrays"
import { EFFECT_SCHEDULING } from "../reactivity/constants"
import { reactiveNotEqual } from "../../util/runtime/sundry"
import { newCleanObj, optc } from "../../util/shared/sundry"
import { FRAG_WHOLE_CONTENT } from "../../util/shared/flags"
import { DuplicateKey, NonTraverse } from "../messages/error"
import { invokeRender, walkNodes } from "../../util/runtime/sundry"
import { renderEffect, runAndUpdateEffect } from "../reactivity/effect"
import { isArray, isNumber, isString, isUndefined } from "../../util/shared/assert"

export function keyedListBlock(
    anchor: ChildNode,
    getValue: Getter,
    getKey: ArbitraryFunc,
    render: ArbitraryFunc
) {
    let holesCount = 0
    let oldKeys: string[] = []
    let traversable!: Traversable
    let infos: Record<string, TraverseInfo | undefined> = newCleanObj()

    const mountKeyedInfo = (
        reference: ChildNode,
        key: string,
        index: number,
        runtimeRender: ArbitraryFunc
    ) => {
        const info: TraverseInfo = {
            s: UNDEF,
            d: NIL as any,
            c: getContext(traversable, index)
        }
        info.d = invokeRender(() => {
            info.s = runtimeRender(reference, info.c)
        })
        infos[key] = info
    }

    const removeKeyedInfo = (key: string, detachNodes: boolean) => {
        const info = infos[key]
        if (!info) {
            return false
        }
        destroy(info.d, detachNodes)
        infos[key] = UNDEF
        return true
    }

    const removeAllKeyedInfos = (oldKeys: string[]) => {
        const oldLength = oldKeys.length
        if (!oldLength) {
            return 0
        }

        let removedCount = 0
        let nodesDetached = false
        const firstInfo = infos[oldKeys[0]]
        const wholeContent = !!(firstInfo && isWholeContentDestruction(firstInfo.d))
        for (let i = 0; i < oldLength; i++) {
            const key = oldKeys[i]
            const info = infos[key]
            if (!info) {
                continue
            }
            if (wholeContent && !nodesDetached) {
                detachWholeContent(info.d, anchor)
                nodesDetached = true
            }
            destroy(info.d, !nodesDetached)
            infos[key] = UNDEF
            removedCount++
        }
        return removedCount
    }

    renderEffect(() => {
        traversable = normalizeTraversable(getValue())

        const oldLength = oldKeys.length
        const newLength = traversable.l
        if (newLength === 0) {
            holesCount += removeAllKeyedInfos(oldKeys)
            infos = newCleanObj()
            holesCount = 0
            oldKeys = []
            return
        }

        if (oldLength === 0) {
            const keyContext: TraverseContext = {
                m: NIL,
                x: NIL
            }
            const newKeys: string[] = Array(newLength)
            const keyVisited: Record<string, number> = newCleanObj()
            for (let i = 0; i < newLength; i++) {
                fillContext(traversable, i, keyContext)
                const key = "" + getKey(keyContext.m, keyContext.x)
                if (!isUndefined(keyVisited[key])) {
                    DuplicateKey(key)
                }
                keyVisited[key] = i
                newKeys[i] = key
            }

            for (let i = newLength - 1; i >= 0; i--) {
                const reference =
                    i < newLength - 1
                        ? (getFirstNodeOfDestruction(infos[newKeys[i + 1]]!.d) ?? anchor)
                        : anchor
                mountKeyedInfo(reference, newKeys[i], i, render)
            }
            oldKeys = newKeys

            if (holesCount > 256 && holesCount > oldKeys.length) {
                const compacted: Record<string, TraverseInfo> = newCleanObj()
                for (let i = 0; i < oldKeys.length; i++) {
                    const key = oldKeys[i]
                    const value = infos[key]
                    if (!isUndefined(value)) {
                        compacted[key] = value
                    }
                }
                infos = compacted
                holesCount = 0
            }
            return
        }

        const keyContext: TraverseContext = {
            m: NIL,
            x: NIL
        }
        const newKeys: string[] = Array(newLength)
        const keyToNewIndex: Record<string, number> = newCleanObj()
        for (let i = 0; i < newLength; i++) {
            fillContext(traversable, i, keyContext)

            const key = "" + getKey(keyContext.m, keyContext.x)
            if (!isUndefined(keyToNewIndex[key])) {
                DuplicateKey(key)
            }
            keyToNewIndex[key] = i
            newKeys[i] = key
        }

        let start = 0
        let oldEnd = oldLength - 1
        let newEnd = newLength - 1
        for (; start <= oldEnd && start <= newEnd; start++) {
            const oldKey = oldKeys[start]
            const newKey = newKeys[start]
            if (oldKey !== newKey) {
                break
            }
            updateBlock(infos[oldKey]!, traversable, start)
        }
        for (; oldEnd >= start && newEnd >= start; oldEnd--, newEnd--) {
            const oldKey = oldKeys[oldEnd]
            const newKey = newKeys[newEnd]
            if (oldKey !== newKey) {
                break
            }
            updateBlock(infos[oldKey]!, traversable, newEnd)
        }

        if (start > oldEnd) {
            for (let i = newEnd; i >= start; i--) {
                const reference =
                    i < newLength - 1
                        ? (getFirstNodeOfDestruction(infos[newKeys[i + 1]]!.d) ?? anchor)
                        : anchor
                mountKeyedInfo(reference, newKeys[i], i, render)
            }
            oldKeys = newKeys

            if (holesCount > 256 && holesCount > oldKeys.length) {
                const compacted: Record<string, TraverseInfo> = newCleanObj()
                for (let i = 0; i < oldKeys.length; i++) {
                    const key = oldKeys[i]
                    const value = infos[key]
                    if (!isUndefined(value)) {
                        compacted[key] = value
                    }
                }
                infos = compacted
                holesCount = 0
            }
            return
        }

        if (start > newEnd) {
            for (let i = start; i <= oldEnd; i++) {
                if (removeKeyedInfo(oldKeys[i], true)) {
                    holesCount++
                }
            }

            oldKeys = newKeys
            if (holesCount > 256 && holesCount > oldKeys.length) {
                const compacted: Record<string, TraverseInfo> = newCleanObj()
                for (let i = 0; i < oldKeys.length; i++) {
                    const key = oldKeys[i]
                    const value = infos[key]
                    if (!isUndefined(value)) {
                        compacted[key] = value
                    }
                }
                infos = compacted
                holesCount = 0
            }
            return
        }

        let patched = 0
        let moved = false
        let maxNewIndexSoFar = 0

        const oldStart = start
        const newStart = start
        const toBePatched = newEnd - newStart + 1
        const newIndexToOldIndexMap = new Int32Array(toBePatched)
        for (let i = oldStart; i <= oldEnd; i++) {
            const oldKey = oldKeys[i]
            if (patched >= toBePatched) {
                if (removeKeyedInfo(oldKey, true)) {
                    holesCount++
                }
                continue
            }

            const newIndex = keyToNewIndex[oldKey]
            if (isUndefined(newIndex) || newIndex < newStart || newIndex > newEnd) {
                if (removeKeyedInfo(oldKey, true)) {
                    holesCount++
                }
                continue
            }

            const mappedIndex = newIndex - newStart
            newIndexToOldIndexMap[mappedIndex] = i + 1

            if (newIndex >= maxNewIndexSoFar) {
                maxNewIndexSoFar = newIndex
            } else {
                moved = true
            }

            updateBlock(infos[oldKey]!, traversable, newIndex)
            patched++
        }

        const stableIndexes = moved ? getIncreasingSequence(newIndexToOldIndexMap) : []
        let stableCursor = stableIndexes.length - 1
        for (let i = toBePatched - 1; i >= 0; i--) {
            const newIndex = newStart + i
            const newKey = newKeys[newIndex]
            const reference =
                newIndex < newLength - 1
                    ? (getFirstNodeOfDestruction(infos[newKeys[newIndex + 1]]!.d) ?? anchor)
                    : anchor

            if (newIndexToOldIndexMap[i] === 0) {
                mountKeyedInfo(reference, newKey, newIndex, render)
                continue
            }

            if (!moved) {
                continue
            }

            if (stableCursor < 0 || i !== stableIndexes[stableCursor]) {
                walkNodes(infos[newKey]!.d, node => {
                    insertBefore(reference, node)
                })
            } else {
                stableCursor--
            }
        }

        oldKeys = newKeys
        if (holesCount > 256 && holesCount > oldKeys.length) {
            const compacted: Record<string, TraverseInfo> = newCleanObj()
            for (let i = 0; i < oldKeys.length; i++) {
                const key = oldKeys[i]
                const value = infos[key]
                if (!isUndefined(value)) {
                    compacted[key] = value
                }
            }
            infos = compacted
            holesCount = 0
        }
    })

    return (key: any) => {
        const info = infos["" + key]
        if (!info) {
            return UNDEF
        }
        return getFirstNodeOfDestruction(info.d) ?? UNDEF
    }
}

export function listBlock(getValue: Getter, render: ArbitraryFunc) {
    let traversable!: Traversable
    const infos: TraverseInfo[] = []

    renderEffect(() => {
        const oldLength = infos.length
        traversable = normalizeTraversable(getValue())

        const newLength = traversable.l
        if (oldLength === 0) {
            for (let i = 0; i < newLength; i++) {
                infos[i] = mountListInfo(traversable, i, render)
            }
            return
        }

        if (newLength === 0) {
            removeAllListInfos(infos)
            return
        }

        const updateLength = Math.min(oldLength, newLength)
        for (let i = 0; i < updateLength; i++) {
            updateBlock(infos[i], traversable, i)
        }
        for (let i = oldLength; i > newLength; i--) {
            destroy(infos.pop()!.d)
        }
        for (let i = oldLength; i < newLength; i++) {
            infos.push(mountListInfo(traversable, i, render))
        }
    })
}

function getIncreasingSequence(items: ArrayLike<number>) {
    const size = items.length
    if (!size) {
        return []
    }

    const predecessors = new Int32Array(size)
    const result: number[] = []
    for (let i = 0; i < size; i++) {
        const item = items[i]
        if (item === 0) {
            continue
        }

        const resultLastIndex = result.length - 1
        if (resultLastIndex < 0 || items[result[resultLastIndex]] < item) {
            predecessors[i] = resultLastIndex < 0 ? -1 : result[resultLastIndex]
            result.push(i)
            continue
        }

        let low = 0
        let high = resultLastIndex
        while (low < high) {
            const middle = (low + high) >> 1
            if (items[result[middle]] < item) {
                low = middle + 1
            } else {
                high = middle
            }
        }

        if (item < items[result[low]]) {
            predecessors[i] = low > 0 ? result[low - 1] : -1
            result[low] = i
        }
    }

    for (
        let i = result.length - 1, last = i >= 0 ? result[i] : -1;
        i >= 0;
        i--, last = predecessors[last]
    ) {
        result[i] = last
    }
    return result
}

function mountListInfo(traversable: Traversable, index: number, render: ArbitraryFunc) {
    let setter: Setter | undefined = UNDEF
    const context = getContext(traversable, index)
    const destruction = invokeRender(() => {
        setter = render(context)
    })
    return {
        s: setter,
        c: context,
        d: destruction
    }
}

function removeAllListInfos(infos: TraverseInfo[]) {
    const oldLength = infos.length
    if (!oldLength) {
        return
    }

    let nodesDetached = false
    const anchor = infos[oldLength - 1].d.n!.nextSibling!
    const wholeContent = isWholeContentDestruction(infos[0].d)
    for (let i = oldLength - 1; i >= 0; i--) {
        const destruction = infos[i].d
        if (wholeContent && !nodesDetached) {
            detachWholeContent(destruction, anchor)
            nodesDetached = true
        }
        destroy(destruction, !nodesDetached)
    }
    infos.length = 0
}

function normalizeTraversable(value: any): Traversable {
    const ret: Traversable = {
        l: 0,
        t: 0,
        k: NIL,
        v: value
    }
    if (isNumber(value)) {
        ret.l = value
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

function detachWholeContent(destruction: Destruction, anchor: ChildNode | null) {
    const parent = destruction.s!.parentElement!
    anchor ??= parent.lastChild!
    parent.textContent = ""
    appendChild(parent, anchor)
}

function getFirstNodeOfDestruction(destruction: Destruction) {
    if (!destruction.s) {
        return NIL
    }
    return destruction.s
}

function isWholeContentDestruction(destruction: Destruction) {
    return !!(destruction.f & FRAG_WHOLE_CONTENT)
}

function getContext(traversable: Traversable, index: number): TraverseContext {
    const context: TraverseContext = {
        m: NIL,
        x: NIL
    }
    return (fillContext(traversable, index, context), context)
}

function updateBlock(oldInfo: TraverseInfo, traversable: Traversable, index: number) {
    const context = oldInfo.c
    const oldM = context.m
    const oldX = context.x
    fillContext(traversable, index, context)

    if (reactiveNotEqual(oldM, context.m) || reactiveNotEqual(oldX, context.x)) {
        oldInfo.s?.(context)

        for (let i = 0; i < (oldInfo.d.e?.length ?? 0); i++) {
            const effect = oldInfo.d.e?.[i]
            if (effect && !(effect.l & EFFECT_SCHEDULING)) {
                runAndUpdateEffect(effect)
            }
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
