import type {
    AnyNode,
    EsPattern,
    PartialBase,
    WalkPatternArr,
    PartialPattern,
    TraverseParent,
    PartialAnyNode,
    AnyNodeWithStartEnd,
    WalkPatternCallback
} from "../../compiler/estree/types"
import { Function } from "@babel/types"
import type { ValueOrValueArr } from "../../runtime/types"
import type { ReplacementItem, ReplacementStatus } from "../../compiler/types"

import * as babel from "@babel/parser"
import { findOutOfComment } from "./strings"
import { isArray, isUndefined } from "../../util/shared/assert"
import { replacementInfo, inputDescriptor } from "../../compiler/state"
import { is, isTypeOperationExpression } from "../../compiler/estree/assert"

// 提取任意节点对应的EsTree节点，忽略ts断言相关语法往下查找
export function getEsNode(node: AnyNode) {
    while (isTypeOperationExpression(node)) {
        node = node.expression
    }
    return node as AnyNodeWithStartEnd
}

// 有些需要定义标识符的插值块可能存在注释，此方法用于提取标识符
export function extractIdentifier(str: string) {
    const start = findOutOfComment(str, /\S/)
    if (start === -1) {
        return {
            identifier: str,
            range: [0, str.length]
        }
    }

    const end = str.slice(start).search(/\s|$/)
    if (end === -1) {
        return {
            range: [start, str.length],
            identifier: str.slice(start)
        }
    }

    return {
        range: [start, start + end],
        identifier: str.slice(start, start + end)
    }
}

// js或ts解析为抽象语法树
export function parse(
    source: string,
    prefixLen: number,
    startSourceIndex: number,
    positionMap?: number[]
) {
    const isCheck = inputDescriptor.options.check

    // @babel/parser解析遇到错误时，将位置修改为正确的源码位置
    const changeErrorLoc = (e: any) => {
        const pos = (e.pos = e.pos - prefixLen) as number
        const sourceIndex = positionMap?.[pos] ?? startSourceIndex + pos

        // 修改报错位置及描述信息
        if (!isUndefined(e.loc)) {
            const { line, column } = (e.loc = inputDescriptor.positions[sourceIndex])
            e.message = e.message.replace(/\(\d+:\d+\)$/, `(${line}:${column})`)
        }
    }

    try {
        const parseOption = {
            sourceType: "module",
            errorRecovery: isCheck
        } as babel.ParserOptions
        if (inputDescriptor.script.isTS) {
            parseOption.plugins = ["typescript"]
        }
        return babel.parse(source, parseOption).program
    } catch (err: any) {
        if (!isCheck) {
            throw (changeErrorLoc(err), err)
        }
    }
}

// 获取Pattern中所有带有访问路径的标识符
export function getIdentifiersFromPatternWithPath(
    source: string,
    nodes: ValueOrValueArr<PartialPattern>
) {
    const ret = new Map<string, string>()
    const patterns = isArray(nodes) ? nodes : [nodes]
    patterns.forEach(pattern => {
        esPatternWalk(pattern, [], (node, pathArr) => {
            const pathStrArr = pathArr!.map(item => {
                if (!isArray(item)) {
                    return item
                }
                return `[${source.slice(item[0], item[1])}]`
            })
            ret.set(node.name, pathStrArr.join(""))
        })
    })
    return ret
}

// 初始化一个replacementItem
export function initReplacementItem(
    options: Pick<ReplacementItem, "index" | "text"> & {
        order?: number
    }
): ReplacementItem {
    // Infinity是最低的优先级
    const id = ++replacementInfo.count
    const order = options.order || Infinity
    return {
        id,
        order,
        processed: false,
        text: options.text,
        index: options.index
    }
}

// 扩展replacement
export function extendReplacement(
    names: ValueOrValueArr<string>,
    useDollar: boolean,
    createSetter: boolean,
    items: ReplacementItem[],
    status: ReplacementStatus = "pending"
) {
    const repl = {
        createSetter,
        useDollar,
        status,
        items
    }
    names = isArray(names) ? names : [names]
    names.forEach(name => {
        replacementInfo.map.set(name, repl)
    })
}

// 提取parent对应的EsTree节点，遇到ts类型操作相关语法时继续向上查找
export function getEsNodeOfParent(cur: TraverseParent | PartialBase) {
    while (isTypeOperationExpression(cur?.v)) {
        cur = cur.parent
    }
    return cur
}

// 遍历标记excludes
export function markExcludes(excludes: Set<string>, identifiers: string[]) {
    identifiers.forEach(identifier => {
        excludes.add(identifier)
    })
}

// FunctionDeclaration和FunctionExpression添加标记excludes的公共处理
export function functionMarkExcludes(node: Function, excludes: Set<string>) {
    node.params.forEach(param => {
        if (!is(param, "TSParameterProperty")) {
            markExcludes(excludes, getIdentifiersFromPattern(param))
        } else {
            markExcludes(excludes, getIdentifiersFromPattern(param.parameter))
        }
    })
    if (is(node, "FunctionDeclaration")) {
        markExcludes(excludes, getIdentifiersFromPattern(node.id))
    }
}

// 获取Pattern中所有的标识符
export function getIdentifiersFromPattern(nodes: ValueOrValueArr<PartialPattern>) {
    const identifiers: string[] = []
    const patterns = isArray(nodes) ? nodes : [nodes]
    patterns.forEach(pattern => {
        esPatternWalk(pattern, undefined, node => {
            identifiers.push(node.name)
        })
    })
    return identifiers
}

// 判断节点是否处于顶部作用域
export function isInTopScope(node: PartialAnyNode, parent: TraverseParent | PartialBase) {
    while (node && !is(node, "Program")) {
        if (
            is(node, "ClassBody") ||
            is(node, "StaticBlock") ||
            is(node, "TSModuleBlock") ||
            is(node, "BlockStatement")
        ) {
            return false
        }
        node = parent?.v
        parent = parent?.parent
    }
    return true
}

// 递归遍历EsPattern节点，当遇到Identifier节点时就会执行传入的回调函数
// 如果传入第二个参数，就会记录Identifier的访问路径，回调函数被调用时会带上这个访问路径组成的数组
// 路径数组是一个引用，所以在callback中只能同步使用，如果异步使用将会遇到访问路径不准确的问题
// 此方法是getIdentifiersFromPattern和getIdentifiersFromPatternWithPath的核心方法
function esPatternWalk(node: PartialPattern, arr: WalkPatternArr, callback: WalkPatternCallback) {
    const shouldRecordPath = !isUndefined(arr)

    const recursive = (n: PartialPattern, carr = arr) => {
        esPatternWalk(n, carr, callback)
    }

    if (node) {
        switch (node.type) {
            case "AssignmentPattern":
                recursive(node.left as EsPattern)
                break
            case "RestElement":
                recursive(node.argument as EsPattern)
                break
            case "Identifier":
                callback(node, arr)
                break

            case "ArrayPattern":
                node.elements.forEach((elem, index) => {
                    const elemPattern = elem as EsPattern
                    if (!shouldRecordPath) {
                        recursive(elemPattern)
                    } else {
                        const carr = arr.slice()
                        carr.push(`[${index}]`)
                        recursive(elemPattern, carr)
                    }
                })
                break

            case "ObjectPattern":
                node.properties.forEach(prop => {
                    if (is(prop, "ObjectProperty")) {
                        if (!shouldRecordPath) {
                            recursive(prop.value as EsPattern)
                        } else {
                            const carr = arr.slice()
                            if (prop.computed) {
                                const { start, end } = prop.key
                                carr.push([start!, end!])
                            } else if (is(prop.key, "Identifier")) {
                                carr.push(`.${prop.key.name}`)
                            }
                            recursive(prop.value as EsPattern, carr)
                        }
                    } else {
                        recursive(prop.argument as EsPattern)
                    }
                })
                break
        }
    }
}
