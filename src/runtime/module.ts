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
    lastElem,
    setArrLength,
    replaceEachItems
} from "../util/shared/sundry"
import { insert } from "./dom"
import { CancelablePromise } from "./promise"
import { isNode } from "../util/runtime/assert"
import { IsModuleFunc, nil } from "./constants"
import { spliceByElem } from "../util/runtime/sundry"
import { DuplicateKey, NonTraverse } from "./message/error"
import { invokeIndexedHooks, onAfterMount } from "./instance"
import { h, toRenderStructure, extendDsts, attachDestroy } from "./h"
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
        updateContext()

        // 这里不能通过省略effect的第三个参数来达到直接执行一次的目的，
        // 因为在在调用attachDestroy和removeEffect的时候需要知道使用的依赖项副作用列表
        const updateGen: DirectiveUpdateFuncGen = (...args) => {
            const unsetEffect = internalPreEffect(updateContext, effectList)
            attachDestroy(unsetEffect, args[5])
            return nil
        }

        const effectList = values(usedEffectList)
        return toRenderStructure(toms, [], {
            t: 2,
            e: effectList,
            v: [1, contextValues, updateGen]
        })
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
                const shouleCreateBlock = newBlockIndex !== -1
                const hasDomOperation = oldBlockIndex !== newBlockIndex
                if (hasDomOperation) {
                    if (isKeyedTop && shouleCreateBlock) {
                        resetFirstKeyedInfoItem(keyedInfo)
                    }
                    if (oldBlockIndex !== -1) {
                        keyedInfo.shift()
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
                                extendNks(keyedInfo[0].nks, nki)
                            }
                        })
                    }
                }
                return (oldBlockIndex = newBlockIndex), hasDomOperation
            }

            if (depsWithGetter) {
                const updateBlockIndex = () => {
                    newBlockIndex = findTrueIndex(ctx, deps)
                }
                const unsetEffect = internalPreEffect(updateBlockIndex, effectList)
                attachDestroy(unsetEffect, dst)
            }

            return depsWithGetter ? updateIfModule : nil
        }

        return toRenderStructure(toms2d[oldBlockIndex], [], {
            t: 0,
            e: effectList,
            v: [oldBlockIndex === -1 ? 0 : 1, [], updateGen]
        })
    })
    return attachMarkForModuleFunc(ifModuleFunc)
}

export function forModule(dep: any, ...toms: TemplateStuOrModuleFunc[]) {
    const depIsGetter = isFunction(dep)
    const ifModuleFunc = withCleanUsedEffectList<ModuleFunc>(ctx => {
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

        return toRenderStructure(toms, [], {
            t: 0,
            e: effectList,
            v: [(oldLength = len(kvPair)), kvPair, updateGen]
        })
    })
    return attachMarkForModuleFunc(ifModuleFunc)
}

export function keyedForModule(dep1: any, dep2: any, ...toms: TemplateStuOrModuleFunc[]) {
    const depIsGetter = isFunction(dep1)
    const keyedForModuleFunc = withCleanUsedEffectList<ModuleFunc>(ctx => {
        let orderedOldKeys: string[] = []
        let orderedWillKeys: [string, number][] = []

        const value = depIsGetter ? dep1(ctx) : dep1
        const effectList = values(usedEffectList)
        const kvPair = getKeyValuePairIterator(value)
        const oldKeyPairIndexMap = new Map<string, [[any, any], number]>()

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

                const newLength = len(dep1(ctx))
                const newKeyedInfo: KeyedInfo = []
                const newDsta: DestructionStruct[] = []
                const notUsedKeyedInfoItem = new Set(keyedInfo.slice(0, -1))

                for (let i = 0, refIndex = 0; i < newLength; i++) {
                    const [willKey, willKeyIndexOfKeyedInfo] = orderedWillKeys[i]
                    if (i === 0) {
                        reference = getFirstNode(keyedInfo[0]) || dref
                    }
                    if (willKeyIndexOfKeyedInfo === -1) {
                        const newDst = extendDsts(dsta)
                        const newKeyedInfoItem = {
                            nks: [],
                            dst: newDst
                        }
                        newDsta.push(newDst)
                        newKeyedInfo.push(newKeyedInfoItem)
                        toms.forEach(tom => {
                            const currentContext = combineContext(directive, context, i)
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
                        hasDomOperation = true
                    } else {
                        if ((hasDomOperation = refKey !== willKey)) {
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
                replaceEachItems(dsta, newDsta)
                newKeyedInfo.push(lastElem(keyedInfo))
                replaceEachItems(keyedInfo, newKeyedInfo)

                return hasDomOperation
            }

            if (depIsGetter) {
                // 新key存在对应的kvPair时候即更新kvPair，否则创建新的pair
                // 记录有序的新key列表和新key对应的KeyedInfoItem的索引（为-1时代表新添加的key）
                const updateContext = () => {
                    const odwk: [string, number][] = []
                    const newPair = getKeyValuePairIterator(dep1(ctx))
                    for (let i = 0; i < len(newPair); i++) {
                        const currentKey = getKey(dep2, newPair, context, i)
                        const pairAndIndex = oldKeyPairIndexMap.get(currentKey)
                        if (i === 0) {
                            setArrLength(kvPair, 0)
                        }
                        if (!pairAndIndex) {
                            kvPair.push(newPair[i])
                        } else {
                            replaceEachItems(pairAndIndex[0], newPair[i])
                            kvPair.push(pairAndIndex[0])
                        }
                        odwk.push([currentKey, pairAndIndex?.[1] ?? -1])
                    }
                    checkDuplicateKey(odwk.map(([k]) => k))
                    directive!.v[0] = len(newPair)
                    orderedWillKeys = odwk
                }

                // 记录旧key与kvPair项及其在KeyedInfo中的索引的映射关系、记录有序的旧key列表
                // orderedOldKeys和updateKeyedForModule中的keyedInfo参数都是上次更新（或初次渲染）后的信息，两者一一对应
                const recordOldKeys = () => {
                    const odok: string[] = []
                    for (let i = 0; i < len(kvPair); i++) {
                        const currentKey = getKey(dep2, kvPair, context, i)
                        oldKeyPairIndexMap.set(currentKey, [kvPair[i], i])
                        odok.push(currentKey)
                    }
                    orderedOldKeys = odok
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
            return depIsGetter ? updateKeyedForModule : nil
        }

        return toRenderStructure(toms, [], {
            t: 1,
            e: effectList,
            v: [len(kvPair), kvPair, updateGen]
        })
    })
    return attachMarkForModuleFunc(keyedForModuleFunc)
}

export function awaitModule(dep: any, ...toms: ValueOrValueArr<TemplateStuOrModuleFunc | null>[]) {
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
            dst,
            dsta,
            isKeyedTop,
            keyedInfo
        ) => {
            const ch = (index: number) => {
                if (toms[index]) {
                    const newDst = extendDsts(dsta)
                    const currentContext = combineContext(directive, context, 0)
                    if (isKeyedTop) {
                        resetFirstKeyedInfoItem(keyedInfo)
                    }
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
                            extendNks(keyedInfo[0].nks, nki)
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

        return toRenderStructure(toms2d[0], [], {
            t: 0,
            e: effectList,
            v: [hasPendingBlock ? 1 : 0, waitRes, updateGen]
        })
    })
    return attachMarkForModuleFunc(awaitModuleFunc)
}

// 为ModuleFunc添加标记
function attachMarkForModuleFunc(fn: ModuleFunc) {
    return (fn[IsModuleFunc] = true), fn
}

// toms means TemplateStructures Or ModuleFuncs
// 将一维或二维的TemplateStuOrModuleFunc|null转换为固定二维结构
function toTwoDemensionalToms(toms: ValueOrValueArr<TemplateStuOrModuleFunc | null>[]) {
    return toms.map(tom => {
        if (isNull(tom)) {
            return []
        }
        if (!isArray(tom)) {
            return [tom]
        }
        return tom
    }) as TemplateStuOrModuleFunc[][]
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
    NonTraverse()
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
function getKey(dep: any, pair: any[] | undefined, context: RenderContext[], index: number) {
    if (!dep || !pair) {
        return "" + index
    }
    if (!isFunction(dep)) {
        return "" + dep
    }

    const md = mockDirective(pair, context[index]?.e as EffectListItem[])
    const currentContext = combineContext(md, context, index)
    return "" + dep(getContextFuncGen(currentContext))
}

// ifModule、awaitModule: 渲染前重置KeyedInfo的第一个项目
function resetFirstKeyedInfoItem(keyedInfo: KeyedInfo) {
    const keyedInfoLen = len(keyedInfo)
    if (keyedInfoLen === 2) {
        keyedInfo[0].nks = []
    } else if (keyedInfoLen === 1) {
        keyedInfo.unshift({
            nks: [],
            dst: nil
        })
    }
}

export { getKeyValuePairIterator }
