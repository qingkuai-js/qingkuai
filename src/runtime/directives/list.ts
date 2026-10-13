import type {
    Destruction,
    Traversable,
    TraverseInfo,
    TraverseContext
} from "#type-declarations/runtime"
import type { ArbitraryFunc, Getter } from "#type-declarations/tools"

import {
    TRAVERSE_SET,
    TRAVERSE_MAP,
    TRAVERSE_NUMBER,
    TRAVERSE_OBJECT,
    TRAVERSE_ARRAYLIKE
} from "./constants"
import { destroy, createDestruction } from "../destroy"
import { invokeRender } from "./render"
import { optc } from "../../util/shared/sundry"
import { NIL, REFLECT, UNDEF } from "../constants"
import { arrayFrom } from "../../util/shared/arrays"
import { walkNodes } from "../../util/runtime/sundry"
import { EFFECT_SCHEDULING } from "../reactivity/constants"
import { reactiveNotEqual } from "../../util/runtime/sundry"
import { FRAG_WHOLE_CONTENT } from "../../util/shared/flags"
import { DuplicateKey, NonTraverse } from "../messages/error"
import {
    currentDestruction,
    currentInstance,
    setCurrentInstance,
    setCurrentDestruction
} from "../state"
import { appendChild, getParentElement, insertBefore } from "../dom"
import { MountCollector, createMountCollector, flushMountCollector } from "../dom"
import { renderEffect, runAndUpdateEffect, runContextEffects } from "../reactivity/effect"
import { DEV } from "../dev"
import { isArray, isNumber, isString, isUndefined } from "../../util/shared/assert"

export function keyedListBlock(
    anchor: ChildNode,
    getValue: Getter,
    getKey: ArbitraryFunc,
    render: ArbitraryFunc
) {
    let holesCount = 0
    let oldKeys: any[] = []
    let traversable!: Traversable
    let infos = new Map<any, TraverseInfo>()

    const componentInstance = currentInstance!
    const parentDestruction = currentDestruction

    const mountKeyedInfo = (
        reference: ChildNode | MountCollector,
        key: any,
        index: number,
        runtimeRender: ArbitraryFunc
    ) => {
        // The context lives on the info object itself so that every row costs a
        // single allocation instead of one for the info plus one for its context.
        const info = { s: UNDEF, d: NIL, m: NIL, x: NIL } as unknown as TraverseInfo
        fillContext(traversable, index, info)
        // 内联 invokeRender：避免为每一行额外分配一个闭包
        // Inlined `invokeRender` to avoid allocating one closure per row.
        const originalInstance = currentInstance
        const destruction = createDestruction(parentDestruction, componentInstance)
        setCurrentInstance(componentInstance)
        info.s = runtimeRender(reference, info)
        setCurrentInstance(originalInstance)
        setCurrentDestruction(parentDestruction)
        info.d = destruction
        infos.set(key, info)
    }

    const removeKeyedInfo = (key: any, detachNodes: boolean) => {
        const info = infos.get(key)
        if (!info) {
            return false
        }
        destroy(info.d, detachNodes)
        infos.delete(key)
        return true
    }

    const removeAllKeyedInfos = (oldKeys: any[]) => {
        const oldLength = oldKeys.length
        if (!oldLength) {
            return 0
        }

        let removedCount = 0
        let nodesDetached = false
        const firstInfo = infos.get(oldKeys[0])
        const wholeContent = !!(firstInfo && isWholeContentDestruction(firstInfo.d))
        for (let i = 0; i < oldLength; i++) {
            const info = infos.get(oldKeys[i])
            if (!info) {
                continue
            }
            if (wholeContent && !nodesDetached) {
                detachWholeContent(info.d, anchor)
                nodesDetached = true
            }
            destroy(info.d, !nodesDetached)
            removedCount++
        }
        // 调用方会立刻用新的 Map 替换 infos，因此无需逐个删除键
        // The caller replaces `infos` with a fresh Map right away, so the keys
        // do not need to be removed one by one.
        return removedCount
    }

    renderEffect(() => {
        traversable = normalizeTraversable(getValue())

        const oldLength = oldKeys.length
        const newLength = traversable.l
        if (newLength === 0) {
            holesCount += removeAllKeyedInfos(oldKeys)
            infos = new Map()
            holesCount = 0
            oldKeys = []
            return
        }

        const keyContext: TraverseContext = {
            m: NIL,
            x: NIL
        }
        const newKeys: any[] = Array(newLength)
        for (let i = 0; i < newLength; i++) {
            fillContext(traversable, i, keyContext)
            newKeys[i] = getKey(keyContext.m, keyContext.x)
        }

        let start = 0
        let oldEnd = oldLength - 1
        let newEnd = newLength - 1
        for (; start <= oldEnd && start <= newEnd; start++) {
            const oldKey = oldKeys[start]
            if (oldKey !== newKeys[start]) {
                break
            }
            updateBlock(infos.get(oldKey)!, traversable, start)
        }
        for (; oldEnd >= start && newEnd >= start; oldEnd--, newEnd--) {
            const oldKey = oldKeys[oldEnd]
            if (oldKey !== newKeys[newEnd]) {
                break
            }
            updateBlock(infos.get(oldKey)!, traversable, newEnd)
        }

        // 只有在尾部循环没有复用任何旧行（`newEnd` 仍是最后一行的索引）时，新增的行才
        // 全部位于列表末尾：此时无需为已有行建立 key 到索引的映射，而且这些行可以一次性
        // 组装并插入（见 MountCollector）。否则新增行位于中间，必须交给下面的通用分支
        // 逐行插入到正确的参考节点之前。
        // Only when the tail loop reused no old row (so `newEnd` is still the index of the
        // last row) are all new rows appended at the tail: no key to index map is needed
        // for the existing rows, and the whole run can be assembled and inserted in one
        // operation (see `MountCollector`). Otherwise the new rows sit in the middle and
        // the general branch below has to insert each of them before its own reference node.
        if (start > oldEnd && newEnd === newLength - 1) {
            const infoCountBefore = infos.size
            const addedCount = newLength - start
            const collector = createMountCollector(anchor)

            for (let i = start; i < newLength; i++) {
                mountKeyedInfo(collector, newKeys[i], i, render)
            }
            flushMountCollector(collector)
            oldKeys = newKeys

            // 重复键会让映射的条目数少于新增行数，此时才去定位重复项（仅在出错时）
            // Duplicate keys make the map hold fewer entries than rows were added;
            // the offending key is only located when the error is actually raised.
            if (infos.size !== infoCountBefore + addedCount) {
                DuplicateKey(DEV ? findDuplicateKey(newKeys, start) : UNDEF)
            }

            if (holesCount > 256 && holesCount > oldKeys.length) {
                infos = new Map(infos)
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
                infos = new Map(infos)
                holesCount = 0
            }
            return
        }

        // 只有在确实需要按键查找时（存在删除、中间插入或移动）才建立索引映射
        // Build the key to index map only when it is really needed, i.e. when rows
        // are removed, inserted in the middle or moved.
        const keyToNewIndex = new Map<any, number>()
        for (let i = 0; i < newLength; i++) {
            const key = newKeys[i]
            if (keyToNewIndex.has(key)) {
                DuplicateKey(key)
            }
            keyToNewIndex.set(key, i)
        }

        let patched = 0
        let moved = false
        let maxNewIndexSoFar = 0

        const oldStart = start
        const newStart = start
        const toBePatched = newEnd - newStart + 1
        const newIndexToOldIndexMap = new Int32Array(toBePatched)

        // 整个列表被完全替换（没有任何旧行被复用）时，可以像清空列表那样一次性
        // 移除全部旧内容，避免为上万个行逐个调用 Node.remove()
        // When the whole list is replaced (not a single old row is reused) the old
        // content can be detached in one operation, like clearing the list does,
        // instead of calling `Node.remove()` for every single row.
        if (
            oldStart === 0 &&
            oldEnd === oldLength - 1 &&
            newEnd === newLength - 1 &&
            !oldKeys.some(key => {
                const newIndex = keyToNewIndex.get(key)
                return !isUndefined(newIndex) && newIndex >= newStart && newIndex <= newEnd
            })
        ) {
            let nodesDetached = false
            const firstInfo = infos.get(oldKeys[0])
            const wholeContent = !!(firstInfo && isWholeContentDestruction(firstInfo.d))
            for (let i = 0; i < oldLength; i++) {
                const info = infos.get(oldKeys[i])
                if (!info) {
                    continue
                }
                if (wholeContent && !nodesDetached) {
                    detachWholeContent(info.d, anchor)
                    nodesDetached = true
                }
                destroy(info.d, !nodesDetached)
            }
            // 所有旧行都已移除，直接重建映射比逐个删除键更快
            infos = new Map()

            const collector = createMountCollector(anchor)
            for (let i = newStart; i <= newEnd; i++) {
                mountKeyedInfo(collector, newKeys[i], i, render)
            }
            flushMountCollector(collector)
            oldKeys = newKeys

            if (holesCount > 256 && holesCount > oldKeys.length) {
                infos = new Map(infos)
                holesCount = 0
            }
            return
        }

        for (let i = oldStart; i <= oldEnd; i++) {
            const oldKey = oldKeys[i]
            if (patched >= toBePatched) {
                if (removeKeyedInfo(oldKey, true)) {
                    holesCount++
                }
                continue
            }

            const newIndex = keyToNewIndex.get(oldKey)
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
            updateBlock(infos.get(oldKey)!, traversable, newIndex)
            patched++
        }

        const stableIndexes = moved ? getIncreasingSequence(newIndexToOldIndexMap) : []
        let stableCursor = stableIndexes.length - 1
        for (let i = toBePatched - 1; i >= 0; i--) {
            const newIndex = newStart + i
            const newKey = newKeys[newIndex]
            const reference =
                newIndex < newLength - 1
                    ? (getFirstNodeOfDestruction(infos.get(newKeys[newIndex + 1])!.d) ?? anchor)
                    : anchor

            if (newIndexToOldIndexMap[i] === 0) {
                mountKeyedInfo(reference, newKey, newIndex, render)
                continue
            }

            if (!moved) {
                continue
            }

            if (stableCursor < 0 || i !== stableIndexes[stableCursor]) {
                walkNodes(infos.get(newKey)!.d, node => {
                    insertBefore(reference, node)
                })
            } else {
                stableCursor--
            }
        }
        oldKeys = newKeys

        if (holesCount > 256 && holesCount > oldKeys.length) {
            infos = new Map(infos)
            holesCount = 0
        }
    })

    return (key: any) => {
        const info = infos.get(key)
        if (!info) {
            return UNDEF
        }
        return getFirstNodeOfDestruction(info.d) ?? UNDEF
    }
}

export function listBlock(getValue: Getter, render: ArbitraryFunc) {
    let traversable!: Traversable
    const infos: TraverseInfo[] = []
    const componentInstance = currentInstance!
    const parentDestruction = currentDestruction

    const mountListInfo = (index: number) => {
        const info = { s: UNDEF, d: NIL, m: NIL, x: NIL } as unknown as TraverseInfo
        fillContext(traversable, index, info)
        info.d = invokeRender(() => (info.s = render(info)), componentInstance, parentDestruction)
        return info
    }

    renderEffect(() => {
        const oldLength = infos.length
        traversable = normalizeTraversable(getValue())

        const newLength = traversable.l
        if (oldLength === 0) {
            for (let i = 0; i < newLength; i++) {
                infos[i] = mountListInfo(i)
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
            infos.push(mountListInfo(i))
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
    const parent = getParentElement(destruction.s!)!
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

// 仅在已经确定存在重复 key 时调用，用于定位重复项并作为错误信息的一部分
// Only called once a duplicate key is known to exist, to locate it for the error.
function findDuplicateKey(keys: any[], appendedFrom: number) {
    const retained = new Set<any>()
    for (let i = 0; i < appendedFrom; i++) {
        retained.add(keys[i])
    }
    const appended = new Set<any>()
    for (let i = appendedFrom; i < keys.length; i++) {
        const key = keys[i]
        if (appended.has(key) || retained.has(key)) {
            return key
        }
        appended.add(key)
    }
    return UNDEF
}

function updateBlock(oldInfo: TraverseInfo, traversable: Traversable, index: number) {
    const oldM = oldInfo.m
    const oldX = oldInfo.x
    fillContext(traversable, index, oldInfo)

    if (reactiveNotEqual(oldM, oldInfo.m) || reactiveNotEqual(oldX, oldInfo.x)) {
        oldInfo.s?.(oldInfo)

        // 行内副作用只需在上下文变化时重新执行，单个副作用被直接存放（见 effect.ts）
        // effect is stored directly (see effect.ts).
        const effects = oldInfo.d.e
        if (isArray(effects)) {
            for (let i = 0; i < effects.length; i++) {
                const effect = effects[i]
                if (effect && !(effect.l & EFFECT_SCHEDULING)) {
                    runAndUpdateEffect(effect)
                }
            }
        } else if (effects && !(effects.l & EFFECT_SCHEDULING)) {
            runAndUpdateEffect(effects)
        }
        // 只依赖循环上下文的绑定不会被响应式调度，由这里重新执行
        // reactive system and are re-run here.
        runContextEffects(oldInfo.d)
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
