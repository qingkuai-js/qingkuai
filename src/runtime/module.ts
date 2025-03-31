import type {
    TopNodes,
    ModuleFunc,
    TopNodesItem,
    PartialNode,
    EffectListItem,
    RenderContext,
    GetContextFunc,
    ValueOrValueArr,
    UnescapeOptions,
    DestructionStruct,
    DirectiveUpdateFuncGen,
    TemplateStuOrModuleFunc,
    NormalTemplateStructure
} from "./types"
import type { FixedArray } from "../util/types"

import {
    arrayFill,
    len,
    optc,
    values,
    entries,
    emptyArr,
    setArrLength,
    replaceEachItems
} from "../util/shared/sundry"
import {
    destroyBlock,
    mockDirective,
    extendTopNodes,
    combineContext,
    newDestruction,
    traverseTopNodes,
    getContextFuncGen,
    putTopNodesIntoItem,
    extendTopNodesBeforeDref,
    appendChildForDestruction
} from "../util/runtime/separate"
import { insert } from "./dom"
import { h, attachDestroy } from "./h"
import { CancelablePromise } from "./promise"
import { invokeIndexedHooks } from "./instance"
import { isModuleFunc, isNode } from "../util/runtime/assert"
import { InvalidTargetForTargetDirective } from "./message/warn"
import { BadTarget, DuplicateKey, NonTraverse } from "./message/error"
import { internalEffect, internalPreEffect } from "./reactivity/effect"
import { usedEffectList, withCleanUsedEffectList } from "./reactivity/state"
import { isArray, isFunction, isNull, isNumber, isString } from "../util/shared/assert"
import { ALIAS_MODULE_KIND, BAD_TAEGET_DIRECTIVE_KIND, IS_MODULE_FUNC, NIL } from "./constants"

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
            return NIL
        }

        return {
            toms,
            directive: {
                e: effectList,
                t: ALIAS_MODULE_KIND,
                v: [1, contextValues, updateGen]
            }
        }
    })
    return markupModuleFunc(aliasModuleFunc)
}

export function targetModule(dep: any, ...toms: TemplateStuOrModuleFunc[]) {
    const depIsGetter = isFunction(dep)
    const targetModuleFunc = withCleanUsedEffectList<ModuleFunc>(ctx => {
        let lastTarget: Node | null = NIL
        const value = depIsGetter ? dep(ctx) : dep
        const effectList = values(usedEffectList)

        const updateGen: DirectiveUpdateFuncGen = (
            instance,
            _,
            target,
            dref,
            context,
            dst,
            topNodes
        ) => {
            const mountOrRepositionTopNodes = (depValue: any) => {
                let newTarget = target
                if (!isString(depValue)) {
                    if (!isNode(depValue) && !isNull(depValue)) {
                        InvalidTargetForTargetDirective()
                    } else {
                        newTarget = depValue ?? target
                    }
                } else {
                    instance.__.hooks[1].unshift(() => {
                        const selected = document.querySelector(depValue)
                        if (!selected) {
                            BadTarget(depValue, BAD_TAEGET_DIRECTIVE_KIND)
                        }
                        newTarget = selected!
                    })
                }

                if (lastTarget === newTarget) {
                    return false
                }

                const newRef = newTarget === target ? dref : NIL
                if (dst.c.length) {
                    traverseTopNodes(topNodes, node => {
                        if (node !== dref) {
                            insert(newTarget, node, newRef)
                        }
                    })
                } else {
                    const newDst = appendChildForDestruction(dst)
                    const newTopNodesItem = extendTopNodes(topNodes)
                    toms.forEach(tom => {
                        putTopNodesIntoItem(
                            newTopNodesItem,
                            h(instance, tom, newTarget, newRef, true, context, newDst)
                        )
                    })
                }
                return (lastTarget = newTarget), true
            }

            mountOrRepositionTopNodes(value)
            if (!depIsGetter) {
                return NIL
            }
            return () => mountOrRepositionTopNodes(dep(ctx))
        }

        return {
            toms: [],
            directive: {
                t: 0,
                e: effectList,
                v: [0, [], updateGen]
            }
        }
    })
    return markupModuleFunc(targetModuleFunc)
}

export function unescapeModule(optionsDep: any, stu: NormalTemplateStructure) {
    const escapeModuleFunc = withCleanUsedEffectList<ModuleFunc>(ctx => {
        const dep: any = stu[1]
        const depIsGetter = isFunction(dep)
        const optionsDepIsGetter = isFunction(optionsDep)
        const options: UnescapeOptions = optionsDepIsGetter ? optionsDep(ctx) : optionsDep

        let html = depIsGetter ? dep(ctx) : dep
        const effectList = values(usedEffectList)
        const nodes = html ? createUnescapeNodes(html, options) : []

        const updateGen: DirectiveUpdateFuncGen = (
            instance,
            _,
            target,
            dref,
            context,
            dst,
            topNodes
        ) => {
            return () => {
                const newHtml = dep(ctx)
                if (newHtml === html) {
                    return false
                }

                if ((destroyBlock(dst.c[0]), newHtml)) {
                    const newDst = appendChildForDestruction(dst)
                    const nodes = createUnescapeNodes(newHtml, options)
                    nodes.forEach(node => {
                        h(instance, node, target, dref, true, context, newDst)
                    })
                    topNodes.unshift(nodes)
                }
                return true
            }
        }

        return {
            toms: nodes,
            directive: {
                t: 0,
                e: effectList,
                v: [nodes.length ? 1 : 0, [], updateGen]
            }
        }
    })
    return markupModuleFunc(escapeModuleFunc)
}

export function ifModule(deps: any[], ...toms: ValueOrValueArr<TemplateStuOrModuleFunc>[]) {
    const toms2d = toTwoDemensionalToms(toms)
    const ifModuleFunc = withCleanUsedEffectList<ModuleFunc>(ctx => {
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
            topNodes
        ) => {
            const updateIfModule = () => {
                const newBlockIndex = findTrueIndex(ctx, deps)
                if (oldBlockIndex === newBlockIndex) {
                    return false
                }

                const shouleCreateBlock = newBlockIndex !== -1
                const shouldDestroyOldBlock = oldBlockIndex !== -1
                if (shouldDestroyOldBlock) {
                    destroyBlock(dst.c[0]!)
                }
                if (shouleCreateBlock) {
                    const newTopNodesItem = extendTopNodesBeforeDref(topNodes, dref)
                    const newDst = appendChildForDestruction(dst)
                    toms2d[newBlockIndex].forEach(tom => {
                        putTopNodesIntoItem(
                            newTopNodesItem,
                            h(instance, tom, target, dref, true, context, newDst)
                        )
                    })
                }
                return (oldBlockIndex = newBlockIndex), true
            }
            return depsWithGetter ? updateIfModule : NIL
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
    return markupModuleFunc(ifModuleFunc)
}

export function forModule(dep: any, ...toms: TemplateStuOrModuleFunc[]) {
    const depIsGetter = isFunction(dep)
    const forModuleFunc = withCleanUsedEffectList<ModuleFunc>(ctx => {
        let oldLength: number
        let newLength: number

        const value = depIsGetter ? dep(ctx) : dep
        const effectList = values(usedEffectList)
        const kvPairs = getKeyValuePairIterator(value)

        const updateGen: DirectiveUpdateFuncGen = (
            instance,
            directive,
            target,
            dref,
            context,
            dst,
            topNodes
        ) => {
            const updateForModule = () => {
                const hasDomOperation = newLength !== oldLength
                for (let i = newLength; i < oldLength; i++) {
                    destroyBlock(dst.c.pop()!)
                }
                for (let i = oldLength; i < newLength; i++) {
                    const newDst = appendChildForDestruction(dst)
                    const currentContext = combineContext(directive, context, i)
                    const newTopNodesItem = extendTopNodesBeforeDref(topNodes, dref)
                    toms.forEach(tom => {
                        putTopNodesIntoItem(
                            newTopNodesItem,
                            h(instance, tom, target, dref, true, currentContext, newDst)
                        )
                    })
                }
                return (oldLength = newLength), hasDomOperation
            }

            if (!depIsGetter) {
                return NIL
            }

            const updateContext = () => {
                const newPair = getKeyValuePairIterator(dep(ctx))
                updateKeyValuePair(kvPairs, newPair)
                newLength = len(newPair)
            }
            return attachDestroy(internalPreEffect(updateContext, effectList), dst), updateForModule
        }

        return {
            toms,
            directive: {
                t: 0,
                e: effectList,
                v: [(oldLength = len(kvPairs)), kvPairs, updateGen]
            }
        }
    })
    return markupModuleFunc(forModuleFunc)
}

export function keyedForModule(dep1: any, dep2: any, ...toms: TemplateStuOrModuleFunc[]) {
    const [dep1IsGetter, dep2IsGetter] = [isFunction(dep1), isFunction(dep2)]
    const keyedForModuleFunc = withCleanUsedEffectList<ModuleFunc>(ctx => {
        let orderedOldKeys: string[] = []
        const orderedWillKeys: [string, number][] = []

        const value = dep1IsGetter ? dep1(ctx) : dep1
        const effectList = values(usedEffectList)
        const kvPairs = getKeyValuePairIterator(value)
        const oldKeyToPairAndIndex = new Map<string, [FixedArray<any, 2>, number]>()

        const updateGen: DirectiveUpdateFuncGen = (
            instance,
            directive,
            target,
            dref,
            context,
            dst,
            topNodes
        ) => {
            const updateKeyedForModule = () => {
                let reference: Node = dref
                let hasDomOperation = false
                let refKey = orderedOldKeys[0]

                const newTopNodes: TopNodes = []
                const sortedPair: FixedArray<any, 2>[] = []
                const destructionsForNotUsedItem = new Set(dst.c)
                const newDestructionChildren: DestructionStruct[] = []

                for (let i = 0, refIndex = 0; i < len(kvPairs); i++) {
                    const [willKey, willKeyIndexOfTopNodes] = orderedWillKeys[i]
                    if (i === 0) {
                        reference = getFirstNode(topNodes[0]) || dref
                    }
                    if (willKeyIndexOfTopNodes === -1) {
                        const newDst = newDestruction()
                        const currentContext = combineContext(directive, context, i)
                        const newTopNodesItem = extendTopNodesBeforeDref(topNodes, dref)
                        toms.forEach(tom => {
                            putTopNodesIntoItem(
                                newTopNodesItem,
                                h(instance, tom, target, reference, true, currentContext, newDst)
                            )
                        })
                        hasDomOperation = true
                        newTopNodes.push(newTopNodesItem)
                        newDestructionChildren.push(newDst)
                    } else {
                        if (refKey !== willKey) {
                            hasDomOperation = true
                            reposition(topNodes[willKeyIndexOfTopNodes], reference)
                        } else {
                            while (
                                topNodes[++refIndex] &&
                                !destructionsForNotUsedItem.has(dst.c[refIndex])
                            );
                            reference = getFirstNode(topNodes[refIndex]) || dref
                            refKey = orderedOldKeys[refIndex]
                        }
                        newTopNodes.push(topNodes[willKeyIndexOfTopNodes])
                        newDestructionChildren.push(dst.c[willKeyIndexOfTopNodes])
                        destructionsForNotUsedItem.delete(dst.c[willKeyIndexOfTopNodes])
                    }
                }

                // 未使用的key对应的节点为需要卸载的节点
                destructionsForNotUsedItem.forEach(dst => {
                    destructionsForNotUsedItem.delete(dst)
                    destroyBlock(dst)
                })
                replaceEachItems(dst.c, newDestructionChildren)
                replaceEachItems(topNodes, newTopNodes)
                updateKeyValuePair(kvPairs, sortedPair)
                return hasDomOperation
            }

            if (!dep1IsGetter && !dep2IsGetter) {
                return NIL
            }

            // 新key存在对应的kvPair时即更新kvPair，否则创建新的kvPair
            // 记录有序的新key列表和新key对应的TopNodes的索引（为-1时代表新添加的key）
            const updateContext = () => {
                const newPairs = getKeyValuePairIterator(dep1(ctx))
                emptyArr(kvPairs, orderedWillKeys)
                for (let i = 0; i < len(newPairs); i++) {
                    const currentKey = getKey(dep2, newPairs, context, i)
                    const oldPairAndIndex = oldKeyToPairAndIndex.get(currentKey)
                    if (!oldPairAndIndex) {
                        kvPairs.push(newPairs[i])
                    } else {
                        kvPairs.push(oldPairAndIndex[0])
                        replaceEachItems(oldPairAndIndex[0], newPairs[i])
                    }
                    orderedWillKeys.push([currentKey, oldPairAndIndex?.[1] ?? -1])
                }
                checkDuplicateKey(orderedWillKeys.map(([k]) => k))
            }

            // 记录旧key到kvPair项及其在TopNodes中的索引的映射关系、记录有序的旧key列表
            // orderedOldKeys和TopNodes参数都是上次更新（或初次渲染）后的信息，两者一一对应
            const recordOldKeys = () => {
                emptyArr(orderedOldKeys)
                oldKeyToPairAndIndex.clear()
                for (let i = 0; i < len(kvPairs); i++) {
                    const currentKey = getKey(dep2, kvPairs, context, i)
                    oldKeyToPairAndIndex.set(currentKey, [kvPairs[i], i])
                    orderedOldKeys.push(currentKey)
                }
            }

            recordOldKeys()
            attachDestroy(internalEffect(recordOldKeys, effectList), dst)
            attachDestroy(internalPreEffect(updateContext, effectList), dst)

            // 记录key指令中依赖项的副作用列表
            usedEffectList.clear()
            checkDuplicateKey(dep2, kvPairs, context)
            effectList.push(...values(usedEffectList))

            return updateKeyedForModule
        }

        return {
            toms,
            directive: {
                t: 0,
                e: effectList,
                v: [len(kvPairs), kvPairs, updateGen]
            }
        }
    })
    return markupModuleFunc(keyedForModuleFunc)
}

export function awaitModule(
    dep: any,
    ...toms: (ValueOrValueArr<TemplateStuOrModuleFunc> | null)[]
) {
    const depIsGetter = isFunction(dep)
    const hasPendingBlock = !isNull(toms[0])
    const toms2d = toTwoDemensionalToms(toms)
    const awaitModuleFunc = withCleanUsedEffectList<ModuleFunc>(ctx => {
        let cp: CancelablePromise<any>
        let pendingBlockIsActivity = true
        let value = depIsGetter ? dep(ctx) : dep

        const waitRes: any[][] = [[]]
        const effectList = values(usedEffectList)

        const updateGen: DirectiveUpdateFuncGen = (
            instance,
            directive,
            target,
            dref,
            context,
            dst,
            topNodes
        ) => {
            const ch = (index: number) => {
                if ((len(dst.c) && destroyBlock(dst.c.pop()!), toms[index])) {
                    const newDst = appendChildForDestruction(dst)
                    const currentContext = combineContext(directive, context, 0)
                    const newTopNodesItem = extendTopNodesBeforeDref(topNodes, dref)
                    toms2d[index].forEach(tom => {
                        putTopNodesIntoItem(
                            newTopNodesItem,
                            h(instance, tom!, target, dref, true, currentContext, newDst)
                        )
                    })
                }
                pendingBlockIsActivity = index === 0
            }

            const awaitPromiseOutcome = (stuIndex: number, pctx: any) => {
                invokeIndexedHooks(instance, 2)
                if (hasPendingBlock) {
                    topNodes.pop()
                    destroyBlock(dst.c.pop()!)
                }
                waitRes[0][0] = pctx
                ch(stuIndex)
                invokeIndexedHooks(instance, 3)
            }

            const mountPromise = (v: Promise<any>) => {
                cp && pendingBlockIsActivity && cp.cancel()
                cp = new CancelablePromise(v)
                cp.then(
                    res => awaitPromiseOutcome(1, res),
                    err => awaitPromiseOutcome(2, err)
                )
            }

            const updateAwaitModule = () => {
                if (!pendingBlockIsActivity) {
                    destroyBlock(dst.c.pop()!)
                    topNodes.pop()
                    ch(0)
                }
                value = dep(ctx)
                mountPromise(value)
                return !pendingBlockIsActivity
            }

            return mountPromise(value), depIsGetter ? updateAwaitModule : null
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
    return markupModuleFunc(awaitModuleFunc)
}

// 为ModuleFunc添加标记
function markupModuleFunc(fn: ModuleFunc) {
    return (fn[IS_MODULE_FUNC] = true), fn
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

// unescapeModule: 通过html内容字符串创建DOM节点
function createUnescapeNodes(html: string, options: UnescapeOptions) {
    const escapeTags: string[] = options.escapeTags || []
    if (options.escapeStyle) {
        escapeTags.push("style")
    }
    if (options.escapeScript) {
        escapeTags.push("script")
    }

    const reSources: string[] = []
    if (escapeTags.length) {
        reSources.push(`</?(?:${escapeTags.join("|")})`)
    }
    if (options.escapeEntities) {
        reSources.push("&(?:[a-zA-Z]+|#d+|#x[a-fA-F0-9]+)")
    }
    if (reSources.length) {
        html = html.replaceAll(new RegExp(`(?:${reSources.join("|")})`, "g"), s => {
            if (s[0] !== "<" && s[0] !== "&") {
                return s
            }
            return (s[0] === "<" ? "&lt;" : "&amp;") + s.slice(1)
        })
    }
    return Array.from(document.createRange().createContextualFragment(html).childNodes)
}

// keyedForModule: 检查是否具有重复的key值
function checkDuplicateKey(arr: any[]): void
function checkDuplicateKey(dep: any, kvPairs: any[], context: RenderContext[]): void
function checkDuplicateKey(depOrArr: any, kvPairs?: any[], context?: RenderContext[]) {
    const usedDep = kvPairs && context
    const existKeys = new Set<string>()
    const times = len(usedDep ? kvPairs : depOrArr)
    for (let i = 0; i < times; i++) {
        const key = usedDep ? getKey(depOrArr, kvPairs, context, i) : depOrArr[i]
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
function getKeyValuePairIterator(value: any): FixedArray<any, 2>[] {
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
function updateKeyValuePair(kvPairs: any[][], newPair: any[][], startIndex = 0) {
    const newPairLength = len(newPair)
    for (let i = startIndex; i < newPairLength; i++) {
        if (!kvPairs[i]) {
            kvPairs[i] = [] as any
        }
        replaceEachItems(kvPairs[i], newPair[i])
    }
    return setArrLength(kvPairs, newPairLength)
}

// keyedForModule: 获取TopNodesItem中的首个节点（作为参考节点）
function getFirstNode(topNodesItem: TopNodesItem | undefined): PartialNode {
    const fst = topNodesItem?.[0]
    if (!fst) {
        return NIL
    }
    if (isNode(fst)) {
        return fst
    }
    return getFirstNode(fst[0])
}

// keyedForModule: 移动当前TopNodes中的节点到正确的位置
function reposition(topNodesItem: TopNodesItem, reference: PartialNode) {
    topNodesItem.forEach(item => {
        if (isNode(item)) {
            insert(item.parentNode!, item, reference)
        } else {
            item.forEach(c => reposition(c, reference))
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
