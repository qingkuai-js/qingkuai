import type { TsNodeWithContext } from "#type-declarations/ts-ast"

import ts from "typescript"

import { walkAncestors } from "./walk"
import { isUpdateExpression, isAssignmentExpression } from "./assert"

// 节点是否处于可提升的顶级作用域（含非函数块级作用域）
// Whether the node is in a hoistable top-level scope (including non-function block scopes).
export function isInHoistableTopLevel(node: TsNodeWithContext): boolean {
    let ret = true
    walkAncestors(node, current => {
        if (current.isNonHoistableScopeBoundary) {
            return ((ret = ts.isSourceFile(current)), true)
        }
    })
    return ret
}

// 获取节点所属的作用域边界节点
// Get the scope boundary node that the node belongs to.
export function getScope(node: TsNodeWithContext): TsNodeWithContext | null {
    let ret: any = null
    walkAncestors(node, current => {
        if (current.isScopeBoundary) {
            return ((ret = current), true)
        }
    })
    return ret
}

// 获取节点所属的不可提升作用域边界节点
// Get the non-hoistable scope boundary node that the node belongs to.
export function getNonHoistableScope(node: TsNodeWithContext): TsNodeWithContext | null {
    let ret: any = null
    walkAncestors(node, current => {
        if (current.isNonHoistableScopeBoundary) {
            return ((ret = current), true)
        }
    })
    return ret
}

// 判断节点是否为标识符形式的赋值目标
// Determine whether the node is an identifier-form assignment target.
export function isIdentifierAssignmentTarget(node: TsNodeWithContext): boolean {
    if (!node.isBindingReference) {
        return false
    }

    let result = false
    const nodeEnd = node.getEnd()
    walkAncestors(node, child => {
        if (ts.isNonNullExpression(child)) {
            return
        }
        if (ts.isPropertyAccessExpression(child) || ts.isElementAccessExpression(child)) {
            return true
        }
        if (isUpdateExpression(child)) {
            return (result = true)
        }
        if (isAssignmentExpression(child)) {
            return (result = nodeEnd <= child.operatorToken.getStart())
        }
    })
    return result
}
