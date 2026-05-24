import type { Range } from "#type-declarations/compiler"
import type { FindNodesPredicate } from "#type-declarations/ts-ast"

import ts from "typescript"

import { walkTsNode } from "./walk"
import { PositionFlag } from "../enums"
import { markPositionFlag } from "../../util/compiler/position"
import { isLastNodeOfParenthesis, isTypeOperation } from "./assert"

export function getNodeRange(node: ts.Node): Range {
    return [node.getStart(), node.getEnd()]
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

export function markNeedSourcemap(node: ts.Node, startSourceIndex: number) {
    markPositionFlag(PositionFlag.SourcemapEnd, startSourceIndex + node.getEnd())
    markPositionFlag(PositionFlag.SourcemapStart, startSourceIndex + node.getStart())
}

/**
 * 获取剥离类型操作后的父节点\
 * Get the parent node after stripping type operations.
 *
 * @param node - 需要剥离类型操作的节点\
 * The node to strip type operations from.
 *
 * @param omitParenthesis - 是否在剥离类型操作时跳过括号表达式节点（即剥离到括号表达式节点的父节点）\
 * Whether to skip parenthesis expression nodes when stripping type operations
 * (i.e., strip to the parent node of the parenthesis expression node).
 *
 * @returns 剥离类型操作后的父节点，如果没有父节点则返回 null\
 * The parent node after stripping type operations, or null if there is no parent node.
 */
export function getStriptTypeOperationsParent<T extends ts.Node>(
    node: T,
    omitParenthesis?: boolean
): T["parent"] | null {
    if (!node.parent) {
        return null
    }
    if (omitParenthesis && isLastNodeOfParenthesis(node)) {
        return getStriptTypeOperationsParent(node.parent, omitParenthesis)
    }
    if (isTypeOperation(node.parent)) {
        return getStriptTypeOperationsParent(node.parent, omitParenthesis)
    }
    return node.parent
}

// 获取括号表达式内最末尾的节点（即最后一个被括号包裹的节点）
// Get the last node inside a parenthesized expression (i.e., the last node wrapped by parentheses).
export function getLastNodeOfParenthesis(node: ts.Node): ts.Node {
    if (!ts.isParenthesizedExpression(node)) {
        return node
    }
    if (ts.isParenthesizedExpression(node.expression)) {
        return getLastNodeOfParenthesis(node.expression)
    }
    if (
        ts.isBinaryExpression(node.expression) &&
        node.expression.operatorToken.kind === ts.SyntaxKind.CommaToken
    ) {
        return getLastNodeOfParenthesis(node.expression.right)
    }
    return node.expression
}

// 获取剥离类型操作后的节点
// Get the node after stripping type operations.
export function getStriptTypeOperationsNode(node: ts.Node, omitParenthesis = false): ts.Node {
    if (omitParenthesis && ts.isParenthesizedExpression(node)) {
        return getStriptTypeOperationsNode(getLastNodeOfParenthesis(node), omitParenthesis)
    }
    if (isTypeOperation(node)) {
        return getStriptTypeOperationsNode(node.expression, omitParenthesis)
    }
    return node
}
