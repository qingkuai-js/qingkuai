/**
 * 此文件是为了避免循环依赖而提取的一些方法
 * This file is a collection of methods extracted to avoid circular dependencies
 * Circular Dependency Reference: https://en.wikipedia.org/wiki/Circular_dependency
 */

import type {
    TopNodes,
    Directive,
    TopNodesItem,
    RenderContext,
    EffectListItem,
    DestructionStruct,
    QingKuaiNodeStruct
} from "../../runtime/types"

import { NOOP } from "../../runtime/constants"
import { isArray, isFunction, isNumber } from "../shared/assert"
import { setUsedEffectList } from "../../runtime/reactivity/state"
import { emptyArr, lastElem, len, runAll } from "../shared/sundry"

// 根据contextValues模拟一个Directive
export function mockDirective(
    contextValues: any[],
    effectList?: EffectListItem[]
): Exclude<Directive, null> {
    return {
        t: 0,
        e: effectList || [],
        v: [0, contextValues, NOOP]
    }
}

// 卸载block
export function destroyBlock(destruction: DestructionStruct) {
    runAll(destruction.v)
    destruction.c.forEach(destroyBlock)
    emptyArr(destruction.v, destruction.c)
}

// 组合嵌套module的context
export function combineContext(
    directive: Directive,
    context: RenderContext[],
    index: number
): RenderContext[] {
    const dv = directive?.v[1][index]
    if (!dv || !len(dv)) {
        return context
    }
    return context.concat({
        v: dv,
        e: directive.e
    })
}

// 扩展TopNodes并返回新创建的元素
export function extendTopNodes(topNodes: TopNodes) {
    const ret: TopNodesItem = []
    topNodes.push(ret)
    return ret
}

// 返回新创建的DestructStruct
export function newDestruction(): DestructionStruct {
    return { v: [], c: [] }
}

// 生成获取context的方法
export function getContextFuncGen(
    context: RenderContext[],
    qknode: QingKuaiNodeStruct | null = null
) {
    return (p: any) => {
        if (isNumber(p)) {
            for (let i = 0; true; i++) {
                const cur = context[i]
                const curvLen = len(cur.v)
                if (p < curvLen) {
                    setUsedEffectList(cur.e)
                    return cur.v[p]
                } else {
                    p = p - curvLen
                }
            }
        } else if (isFunction(p)) {
            return qknode ? p.bind(qknode.n) : p
        }
    }
}

// 扩展TopNodes（在dref之前）并返回新创建的元素（Module中的dref始终应保持在最后）
export function extendTopNodesBeforeDref(topNodes: TopNodes, dref: Text) {
    const ret: TopNodesItem = []
    if (lastElem(topNodes)?.[0] !== dref) {
        topNodes.push(ret)
    } else {
        topNodes.pop()
        topNodes.push(ret, [dref])
    }
    return ret
}

// 扩展destruction子元素并返回新创建的DestructionStruct
export function appendChildForDestruction(destruction: DestructionStruct) {
    const ret = newDestruction()
    destruction.c.push(ret)
    return ret
}

export function putTopNodesIntoItem(item: TopNodesItem, topNodes: TopNodes) {
    topNodes.forEach(tn => item.push(...tn))
}

// 遍历TopNodes中的DOM节点
export function traverseTopNodes(topNodes: TopNodes | TopNodesItem, cb: (node: Node) => void) {
    topNodes.forEach(item => {
        if (!isArray(item)) {
            cb(item)
        } else {
            traverseTopNodes(item, cb)
        }
    })
}
