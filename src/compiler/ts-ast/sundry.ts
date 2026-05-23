import type { FindNodesPredicate } from "#type-declarations/ts-ast"

import ts from "typescript"

import { walkTsNode } from "./walk"
import { isTypeOperation } from "./assert"

export function stripTypeExpressions(node: ts.Node) {
    if (isTypeOperation(node)) {
        return stripTypeExpressions(node.expression)
    }
    return node
}

export function findFirstChildUntil<T extends ts.Node>(
    sourceFile: ts.SourceFile,
    predicate: FindNodesPredicate<T>
): T | null {
    let result: T | null = null
    walkTsNode(sourceFile, node => {
        if (predicate(node)) {
            return !!(result = node)
        }
    })
    return result
}

export function findFirstAncestorUntil<T extends ts.Node>(
    node: ts.Node,
    predicate: FindNodesPredicate<T>
): T | null {
    for (let current = node.parent; current; current = current.parent) {
        if (predicate(current)) {
            return current
        }
    }
    return null
}

export function striptTypeOperationsParent(node: ts.Node): ts.Node | null {
    if (!node.parent) {
        return null
    }
    if (!isTypeOperation(node.parent)) {
        return node.parent
    }
    return striptTypeOperationsParent(node.parent)
}
