/**
 * 此文件是为了避免循环依赖而提取的一些方法
 * This file is a collection of methods extracted to avoid circular dependencies
 * Circular Dependency Reference: https://en.wikipedia.org/wiki/Circular_dependency
 */

import type {
    Directive,
    PartialNode,
    RenderContext,
    EffectListItem,
    DestructionStruct
} from "../../runtime/types"

import { len, runAll } from "../shared/sundry"
import { NIL, NOOP } from "../../runtime/constants"
import { isFunction, isNumber } from "../shared/assert"
import { setUsedEffectList } from "../../runtime/reactivity/state"

// 返回新创建的DestructStruct
export function newDestruction(): DestructionStruct {
    return {
        v: [],
        c: new Set()
    }
}

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
    destruction.c.forEach(child => {
        child.forEach(destroyBlock)
    })
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

// 生成获取context的方法
export function getContextFuncGen(context: RenderContext[], node: PartialNode = NIL) {
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
            return p.bind(node)
        }
    }
}
