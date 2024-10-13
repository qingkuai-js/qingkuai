import type { ASTVisitor, AnyNode, TraverseParent } from "./types"

import { isArray, isUndefined } from "../../util/shared/assert"

// 递归遍历 Acorn AST 的方法
// visitor遍历匹配器，如果visitor中含有以当前AST节点的类型为名称的属性则会电泳此方法并传入三个参数：node, parent, excludes
// parent代表当前节点的父节点， excludes为一个标识符列表，其代表当前作用域下被标记的标识符不是顶层作用于标识符的引用，无需转换处理
export function walk(
    node: any,
    visitor: ASTVisitor,
    parent: TraverseParent = {
        v: null,
        parent: null,
        excludes: new Set<string>()
    }
) {
    // 检查模式下的遇到babel内部错误时，直接返回
    if (isUndefined(node)) return

    const visit = visitor[node.type as keyof ASTVisitor]
    const keys = Object.keys(node) as any[]
    const r = (n: AnyNode) => {
        if (n.loc) {
            const curParent = {
                parent,
                v: node,
                excludes: new Set(parent.excludes)
            }
            walk(n, visitor, curParent)
        }
    }

    if (visit) {
        visit(node as any, parent)
    }
    visitor.AnyNode?.(node as any, parent)

    for (const key of keys) {
        if (node[key] && typeof node[key] === "object") {
            const value = node[key]
            if (isArray(value)) {
                value.forEach(v => {
                    r(v)
                })
            } else {
                r(value)
            }
        }
    }
}
