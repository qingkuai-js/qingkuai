import type {
    KeyedInfo,
    ModuleFunc,
    KeyedInfoItem,
    PartialNode,
    EffectListItem,
    RenderContext,
    GetContextFunc,
    ValueOrValueArr,
    DestructionStruct,
    DirectiveUpdateFuncGen,
    TemplateStuOrModuleFunc
} from "./types"

import {
    extendNks,
    destroyBlock,
    mockDirective,
    combineContext,
    getContextFuncGen
} from "../util/runtime/separate"
import {
    arrayFill,
    len,
    optc,
    values,
    entries,
    setArrLength,
    replaceEachItems
} from "../util/shared/sundry"
import { insert } from "./dom"
import { CancelablePromise } from "./promise"
import { IsModuleFunc, nil, noop } from "./constants"
import { h, extendDsts, attachDestroy } from "./h"
import { spliceByElem } from "../util/runtime/sundry"
import { DuplicateKey, NonTraverse } from "./message/error"
import { isModuleFunc, isNode } from "../util/runtime/assert"
import { invokeIndexedHooks, onAfterMount } from "./instance"
import { internalEffect, internalPreEffect } from "./reactivity/effect"
import { usedEffectList, withCleanUsedEffectList } from "./reactivity/state"
import { isArray, isFunction, isNull, isNumber } from "../util/shared/assert"

export function aliasModule(rules: any[], ...toms: TemplateStuOrModuleFunc[]) {
    const aliasModuleFunc = withCleanUsedEffectList<ModuleFunc>(ctx => {
        const contextValues: any[][] = [[]]

        const updateContext = () => {
            for (let i = 0; i < len(rules); i += 2) {
                const [arg, fn] = [rules[i], rules[i + 1]]
                const argIsGetter = isFunction(arg)
                const argv = argIsGetter ? arg(ctx) : arg
                if (i !== 0) {
                    contextValues[0].push(...fn(argv))
                } else {
                    replaceEachItems(contextValues[0], fn(argv))
                }
            }
        }

        // 这里不能通过省略effect的第三个参数来达到直接执行一次的目的
        // 因为在在调用attachDestroy和removeEffect的时候需要知道使用的依赖项副作用列表
        const effectList = (updateContext(), values(usedEffectList))
        const updateGen: DirectiveUpdateFuncGen = (...args) => {
            const unsetEffect = internalPreEffect(updateContext, effectList)
            attachDestroy(unsetEffect, args[5])
            return nil
        }

        return {
            toms,
            directive: {
                t: 2,
                e: effectList,
                v: [1, contextValues, updateGen]
            }
        }
    })
    return attachMarkForModuleFunc(aliasModuleFunc)
}

export function ifModule(deps: any[], ...toms: ValueOrValueArr<TemplateStuOrModuleFunc>[]) {
    const toms2d = toTwoDemensionalToms(toms)
    const ifModuleFunc = withCleanUsedEffectList<ModuleFunc>(ctx => {
        let newBlockIndex: number
        let oldBlockIndex = findTrueIndex(ctx, deps)

        const effectList = values(usedEffectList)
        const depsWithGetter = usedEffectList.size > 0

        const updateGen: DirectiveUpdateFuncGen = (
            instance,
            _,
            target,
            dref,
            context,
            dst,
            dsta,
            isKeyedTop,
            keyedInfo
        ) => {
            const updateIfModule = () => {
                if (oldBlockIndex === newBlockIndex) {
                    return false
                }

                const shouleCreateBlock = newBlockIndex !== -1
                const shouldDestroyOldBlock = oldBlockIndex !== -1
                if (shouldDestroyOldBlock) {
                    destroyBlock(dsta.pop()!)
                }
                if (shouleCreateBlock) {
                    const newDst = extendDsts(dsta)
                    toms2d[newBlockIndex].forEach(tom => {
                        const nki = h(
                            instance,
                            tom,
                            target,
                            dref,
                            true,
                            context,
                            newDst,
                            isKeyedTop
                        )
                        if (isKeyedTop) {
                            replaceEachItems(keyedInfo, [
                                {
                                    dst: newDst,
                                    nks: [nki]
                                }
                            ])
                        }
                    })
                }
                return (oldBlockIndex = newBlockIndex), true
            }

            if (!depsWithGetter) {
                return nil
            }

            const updateBlockIndex = () => {
                newBlockIndex = findTrueIndex(ctx, deps)
            }
            const unsetEffect = internalPreEffect(updateBlockIndex, effectList)
            return attachDestroy(unsetEffect, dst), updateIfModule
        }

        return {
            toms: toms2d[oldBlockIndex],
            directive: {
                t: 0,
                e: effectList,
                v: [oldBlockIndex === -1 ? 0 : 1, [], updateGen]
            }
        }
    })
    return attachMarkForModuleFunc(ifModuleFunc)
}

export function forModule(dep: any, ...toms: TemplateStuOrModuleFunc[]) {
    const depIsGetter = isFunction(dep)
    const forModuleFunc = withCleanUsedEffectList<ModuleFunc>(ctx => {
        let oldLength: number
        let newLength: number

        const value = depIsGetter ? dep(ctx) : dep
        const effectList = values(usedEffectList)
        const kvPair = getKeyValuePairIterator(value)

        const updateGen: DirectiveUpdateFuncGen = (
            instance,
            directive,
            target,
            reference,
            context,
            dst,
            dsta,
            isKeyedTop,
            keyedInfo
        ) => {
            const updateForModule = () => {
                const drefKeyedInfo = keyedInfo.pop()!
                const hasDomOperation = newLength !== oldLength
                for (let i = newLength; i < oldLength; i++) {
                    if (isKeyedTop) {
                        keyedInfo.pop()
                    }
                    destroyBlock(dsta.pop()!)
                }
                for (let i = oldLength; i < newLength; i++) {
                    const newDst = extendDsts(dsta)
                    const currentContext = combineContext(directive, context, i)
                    if (isKeyedTop) {
                        keyedInfo[i] = {
                            nks: [],
                            dst: newDst
                        }
                    }
                    toms.forEach(tom => {
                        const nki = h(
                            instance,
                            tom,
                            target,
                            reference,
                            true,
                            currentContext,
                            newDst,
                            isKeyedTop
                        )
                        if (isKeyedTop) {
                            extendNks(keyedInfo[i].nks, nki)
                        }
                    })
                }
                if (isKeyedTop) {
                    keyedInfo.push(drefKeyedInfo)
                }
                return (oldLength = newLength), hasDomOperation
            }

            if (depIsGetter) {
                const updateContext = () => {
                    const newPair = getKeyValuePairIterator(dep(ctx))
                    updateKeyValuePair(kvPair, newPair)
                    newLength = len(newPair)
                }
                const unsetEffect = internalPreEffect(updateContext, effectList)
                attachDestroy(unsetEffect, dst)
            }

            return depIsGetter ? updateForModule : nil
        }

        return {
            toms,
            directive: {
                t: 0,
                e: effectList,
                v: [(oldLength = len(kvPair)), kvPair, updateGen]
            }
        }
    })
    return attachMarkForModuleFunc(forModuleFunc)
}

export function keyedForModule(dep1: any, dep2: any, ...toms: TemplateStuOrModuleFunc[]) {
    const [dep1IsGetter, dep2IsGetter] = [isFunction(dep1), isFunction(dep2)]
    const keyedForModuleFunc = withCleanUsedEffectList<ModuleFunc>(ctx => {
        let orderedOldKeys: string[] = []
        let orderedWillKeys: [string, number][] = []

        // 记录usedEffectList
        dep2IsGetter && dep2(2, noop)

        const value = dep1IsGetter ? dep1(ctx) : dep1
        const effectList = values(usedEffectList)
        const kvPair = getKeyValuePairIterator(value)
        const oldKeyToPairAndIndex = new Map<string, [[any, any], number]>()

        const updateGen: DirectiveUpdateFuncGen = (
            instance,
            directive,
            target,
            dref,
            context,
            dst,
            dsta,
            _,
            keyedInfo
        ) => {
            const updateKeyedForModule = () => {
                let reference: Node = dref
                let hasDomOperation = false
                let refKey = orderedOldKeys[0]

                const newLength = len(kvPair)
                const newKeyedInfo: KeyedInfo = []
                const newDsta: DestructionStruct[] = []
                const notUsedKeyedInfoItem = new Set(keyedInfo)

                for (let i = 0, refIndex = 0; i < newLength; i++) {
                    const [willKey, willKeyIndexOfKeyedInfo] = orderedWillKeys[i]
                    if (i === 0) {
                        reference = getFirstNode(keyedInfo[0]) || dref
                    }
                    if (willKeyIndexOfKeyedInfo === -1) {
                        const currentContext = combineContext(directive, context, i)
                        const newDst = extendDsts(dsta)
                        const newKeyedInfoItem = {
                            nks: [],
                            dst: newDst
                        }
                        toms.forEach(tom => {
                            const nki = h(
                                instance,
                                tom,
                                target,
                                reference,
                                true,
                                currentContext,
                                newDst,
                                true
                            )
                            extendNks(newKeyedInfoItem.nks, nki)
                        })
                        newDsta.push(newDst)
                        hasDomOperation = true
                        newKeyedInfo.push(newKeyedInfoItem)
                    } else {
                        if (refKey !== willKey) {
                            hasDomOperation = true
                            reposition(keyedInfo[willKeyIndexOfKeyedInfo], reference)
                        } else {
                            while (
                                keyedInfo[++refIndex] &&
                                !notUsedKeyedInfoItem.has(keyedInfo[refIndex])
                            );
                            reference = getFirstNode(keyedInfo[refIndex]) || dref
                            refKey = orderedOldKeys[refIndex]
                        }
                        newDsta.push(keyedInfo[willKeyIndexOfKeyedInfo].dst!)
                        newKeyedInfo.push(keyedInfo[willKeyIndexOfKeyedInfo])
                        notUsedKeyedInfoItem.delete(keyedInfo[willKeyIndexOfKeyedInfo])
                    }
                }

                // 未使用的key对应的节点为需要卸载的节点
                notUsedKeyedInfoItem.forEach(item => {
                    notUsedKeyedInfoItem.delete(item)
                    item.dst && destroyBlock(item.dst)
                })
                replaceEachItems(keyedInfo, newKeyedInfo)
                replaceEachItems(dsta, newDsta)
                return hasDomOperation
            }

            if (dep1IsGetter) {
                // 新key存在对应的kvPair时即更新kvPair，否则创建新的pair
                // 记录有序的新key列表和新key对应的KeyedInfoItem的索引（为-1时代表新添加的key）
                const updateContext = () => {
                    const newPair = getKeyValuePairIterator(dep1(ctx))
                    setArrLength(kvPair, 0)
                    setArrLength(orderedWillKeys, 0)
                    for (let i = 0; i < len(newPair); i++) {
                        const currentKey = getKey(dep2, newPair, context, i)
                        const oldPairAndIndex = oldKeyToPairAndIndex.get(currentKey)
                        if (oldPairAndIndex) {
                            kvPair.push(oldPairAndIndex[0])
                            replaceEachItems(oldPairAndIndex[0], newPair[i])
                        } else {
                            kvPair.push(newPair[i])
                        }
                        orderedWillKeys.push([currentKey, oldPairAndIndex?.[1] ?? -1])
                    }
                    checkDuplicateKey(orderedWillKeys.map(([k]) => k))
                    directive!.v[0] = len(newPair)
                }

                // 记录旧key到kvPair项及其在KeyedInfo中的索引的映射关系、记录有序的旧key列表
                // orderedOldKeys和keyedInfo参数都是上次更新（或初次渲染）后的信息，两者一一对应
                const recordOldKeys = () => {
                    oldKeyToPairAndIndex.clear()
                    setArrLength(orderedOldKeys, 0)

                    for (let i = 0; i < len(kvPair); i++) {
                        const currentKey = getKey(dep2, kvPair, context, i)
                        oldKeyToPairAndIndex.set(currentKey, [kvPair[i], i])
                        orderedOldKeys.push(currentKey)
                    }
                }

                const unsetRecordKeysEffect = internalEffect(recordOldKeys, effectList)
                const unsetUpdateContextEffect = internalPreEffect(updateContext, effectList)
                const unsetEffect = () => {
                    unsetRecordKeysEffect()
                    unsetUpdateContextEffect()
                    spliceByElem(instance.__.hooks[1], recordOldKeys)
                }

                onAfterMount(recordOldKeys)
                attachDestroy(unsetEffect, dst)
            }

            checkDuplicateKey(dep2, kvPair, context)
            return dep1IsGetter || dep2IsGetter ? updateKeyedForModule : nil
        }

        return {
            toms,
            directive: {
                t: 1,
                e: effectList,
                v: [len(kvPair), kvPair, updateGen]
            }
        }
    })
    return attachMarkForModuleFunc(keyedForModuleFunc)
}

export function awaitModule(
    dep: any,
    ...toms: (ValueOrValueArr<TemplateStuOrModuleFunc> | null)[]
) {
    const depIsGetter = isFunction(dep)
    const hasPendingBlock = !isNull(toms[0])
    const toms2d = toTwoDemensionalToms(toms)
    const awaitModuleFunc = withCleanUsedEffectList<ModuleFunc>(ctx => {
        let currentIsPending = true
        let cp: CancelablePromise<any>
        let value = depIsGetter ? dep(ctx) : dep

        const waitRes: any[][] = [[]]
        const effectList = values(usedEffectList)

        const updateGen: DirectiveUpdateFuncGen = (
            instance,
            directive,
            target,
            reference,
            context,
            _,
            dsta,
            isKeyedTop,
            keyedInfo
        ) => {
            const ch = (index: number) => {
                if (toms[index]) {
                    const newDst = extendDsts(dsta)
                    const currentContext = combineContext(directive, context, 0)
                    toms2d[index].forEach(tom => {
                        const nki = h(
                            instance,
                            tom!,
                            target,
                            reference,
                            true,
                            currentContext,
                            newDst,
                            isKeyedTop
                        )
                        if (isKeyedTop) {
                            replaceEachItems(keyedInfo, [
                                {
                                    dst: newDst,
                                    nks: [nki]
                                }
                            ])
                        }
                    })
                }
                currentIsPending = index === 0
            }

            const awaitPromiseOutcome = (stuIndex: number, pctx: any) => {
                invokeIndexedHooks(instance, 2)
                if (hasPendingBlock) {
                    if (isKeyedTop) {
                        keyedInfo.shift()
                    }
                    destroyBlock(dsta.pop()!)
                }
                waitRes[0][0] = pctx
                ch(stuIndex)
                invokeIndexedHooks(instance, 3)
            }

            const mountPromise = (v: Promise<any>) => {
                cp && currentIsPending && cp.cancel()
                cp = new CancelablePromise(v)
                cp.then(
                    res => awaitPromiseOutcome(1, res),
                    err => awaitPromiseOutcome(2, err)
                )
            }

            const updateAwaitModule = () => {
                const hasDomOperation = !currentIsPending && hasPendingBlock
                if (hasDomOperation) {
                    destroyBlock(dsta.pop()!)
                    if (isKeyedTop) {
                        keyedInfo.shift()
                    }
                    ch(0)
                }
                value = dep(ctx)
                mountPromise(value)
                return hasDomOperation
            }

            mountPromise(value)

            return depIsGetter ? updateAwaitModule : null
        }

        return {
            toms: toms2d[0],
            directive: {
                t: 0,
                e: effectList,
                v: [hasPendingBlock ? 1 : 0, waitRes, updateGen]
            }
        }
    })
    return attachMarkForModuleFunc(awaitModuleFunc)
}

// 为ModuleFunc添加标记
function attachMarkForModuleFunc(fn: ModuleFunc) {
    return (fn[IsModuleFunc] = true), fn
}

// toms means TemplateStructures Or ModuleFuncs
// 将一维或二维的TemplateStuOrModuleFunc|null转换为固定二维结构
function toTwoDemensionalToms(
    toms: (ValueOrValueArr<TemplateStuOrModuleFunc> | null)[]
): TemplateStuOrModuleFunc[][] {
    return toms.map<any>(tom => {
        if (isNull(tom)) {
            return []
        }
        return isArray(tom) && (isArray(tom[0]) || isModuleFunc(tom[0])) ? tom : [tom]
    })
}

// keyedForModule: 检查是否具有重复的key值
function checkDuplicateKey(arr: any[]): void
function checkDuplicateKey(dep: any, kvPair: any[], context: RenderContext[]): void
function checkDuplicateKey(depOrArr: any, kvPair?: any[], context?: RenderContext[]) {
    const usedDep = kvPair && context
    const existKeys = new Set<string>()
    const times = len(usedDep ? kvPair : depOrArr)
    for (let i = 0; i < times; i++) {
        const key = usedDep ? getKey(depOrArr, kvPair, context, i) : depOrArr[i]
        if (existKeys.has(key)) {
            DuplicateKey(key)
        } else {
            existKeys.add(key)
        }
    }
}

// ifModule: 获取中要展示的块索引
function findTrueIndex(ctx: GetContextFunc, deps: any) {
    const vs = (isArray(deps) ? deps : [deps]).map((dep: any) => {
        return isFunction(dep) ? dep(ctx) : dep
    })
    return vs.findIndex((dep: any) => dep)
}

// (keyed)forModule: 获取不同类型值的键值对迭代器
function getKeyValuePairIterator(value: any): [any, any][] {
    const tps = optc(value)
    if (/Object|Array|String/.test(tps)) {
        return Object.entries(value)
    }
    if (tps === "Set") {
        return values(value).map((v, i) => {
            return [i, v]
        })
    }
    if (tps === "Map") {
        return entries(value)
    }
    if (isNumber(value)) {
        return arrayFill(value || 0, 0).map((_, index) => {
            return [index, index + 1]
        })
    }
    return NonTraverse()
}

// (keyed)forModule: 更新键值对
function updateKeyValuePair(kvPair: any[][], newPair: any[][], startIndex = 0) {
    const newPairLength = len(newPair)
    for (let i = startIndex; i < newPairLength; i++) {
        if (!kvPair[i]) {
            kvPair[i] = [] as any
        }
        replaceEachItems(kvPair[i], newPair[i])
    }
    return setArrLength(kvPair, newPairLength)
}

// keyedForModule: 获取KeyedInfo中的首个节点（作为参考节点）
function getFirstNode(keyedInfoItem: KeyedInfoItem | undefined): PartialNode {
    const fst = keyedInfoItem?.nks[0]
    if (!fst) {
        return nil
    }
    if (isNode(fst)) {
        return fst
    }
    return getFirstNode(fst[0])
}

// keyedForModule: 移动当前KeyedInfoItem中的节点到正确的位置
function reposition(keyedInfoItem: KeyedInfoItem, reference: PartialNode) {
    keyedInfoItem.nks.forEach(nk => {
        if (isNode(nk)) {
            insert(nk.parentNode!, nk, reference)
        } else {
            nk.forEach(ki => {
                reposition(ki, reference)
            })
        }
    })
}

// keyedForModule: 获取key
function getKey(dep: any, pairs: any[], context: RenderContext[], index: number) {
    if (!isFunction(dep)) {
        return "" + dep
    }

    const md = mockDirective(pairs, context[index]?.e as EffectListItem[])
    const currentContext = combineContext(md, context, index)
    return "" + dep(getContextFuncGen(currentContext))
}

export { getKeyValuePairIterator }
