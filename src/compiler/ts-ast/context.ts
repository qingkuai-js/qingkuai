import type { TsNodeWithContext } from "#type-declarations/ts-ast"

import ts from "typescript"
import { walkAncestors } from "./walk"

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
//
// v8 ignore next -- reserved for future feature
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

// 名字是否被节点自身或任一祖先作用域边界声明（即是否被遮蔽），节点需先经过 walkTsNodeWithContext 附加上下文
// Whether the name is declared by the node itself (when it is a scope boundary) or by any ancestor
// scope boundary. The node must have been walked by walkTsNodeWithContext.
export function isShadowedIdentifier(node: TsNodeWithContext, name: string) {
    for (let current: TsNodeWithContext | undefined = node; current; current = current.parent) {
        if (current.scopeIdentifiers?.has(name)) {
            return true
        }
    }
    return false
}
