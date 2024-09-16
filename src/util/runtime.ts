import type {
    KeyedInfo,
    Directive,
    ModuleFunc,
    PartialNode,
    RenderContext,
    KeyedInfoItem,
    EffectListItem,
    DestructionStruct
} from "../runtime/types"
import type { EventWrapperFlagKeys, EventListenerFlagKeys } from "./types"

import { setUsedEffectList } from "../runtime/reactivity/state"
import { IsModuleFunc, IsProxy, nil, noop } from "../runtime/constants"
import { len, runAll, isNumber, isFunction, EventWrapperFlag, EventListenerFlag } from "./shared"

// 判断值是否为响应式值
export function isReactive(v: any) {
    return v?.[IsProxy] === true
}

// 判断是否DOM节点
export function isNode(v: any): v is Node {
    return isNumber(v.nodeType)
}

// 判断是否是ModuleFunc类型
export function isModuleFunc(v: any): v is ModuleFunc {
    return !!v?.[IsModuleFunc]
}

// velf means Verify Event Listener Flag
export function velf(flag: number, key: EventListenerFlagKeys) {
    return !!(EventListenerFlag[key] & flag)
}

// vewf meas Verify Event Wrapper Flag
export function vewf(flag: number, key: EventWrapperFlagKeys) {
    return !!(EventWrapperFlag[key] & flag)
}

// 通过指定元素删除数组中对应的元素（只会删除第一个匹配项）
export function spliceByElem<T>(arr: T[], elem: T) {
    const index = arr.indexOf(elem)
    if (index !== -1) {
        arr.splice(index, 1)
    }
}

// 注意：从这里往下的方法提取到util是为了避免循环引用
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
        v: [0, contextValues, noop]
    }
}

// 扩展KeyedInfoItem.nks
export function extendNks(nks: KeyedInfoItem["nks"], nki: KeyedInfo) {
    if (len(nki) !== 1) {
        nks.push(nki)
    } else {
        nki[0].nks.forEach(nk => {
            nks.push(nk)
        })
    }
}

// 卸载block
export function destroyBlock(destruction: DestructionStruct) {
    runAll(destruction.v)
    destruction.c.forEach(child => {
        child.forEach(dst => {
            destroyBlock(dst)
        })
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
export function getContextFuncGen(context: RenderContext[], node: PartialNode = nil) {
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
