import type { TSModuleDeclaration } from "@babel/types"
import type { AnyNode, PartialAnyNode } from "#type-declarations/estree"

import { stripTypeExpressions } from "./sundry"
import { getLastElem } from "../../shared/arrays"

export function isLeftValue(node: AnyNode) {
    switch ((node = stripTypeExpressions(node)).type) {
        case "MemberExpression": {
            return true
        }
        case "Identifier": {
            return node.name !== "undefined"
        }
    }
    return false
}

export function is<T extends AnyNode["type"]>(
    node: PartialAnyNode,
    type: T
): node is AnyNode & { type: T } {
    return node?.type === type
}

export function isTypeOperation(node: AnyNode) {
    return (
        node.type === "TSAsExpression" ||
        node.type === "TSTypeAssertion" ||
        node.type === "TSNonNullExpression" ||
        node.type === "TSSatisfiesExpression"
    )
}

export function isLiteral(node: PartialAnyNode) {
    switch (node?.type) {
        case undefined:
        case "NullLiteral":
        case "RegexLiteral":
        case "RegExpLiteral":
        case "BigIntLiteral":
        case "StringLiteral":
        case "NumberLiteral":
        case "NumericLiteral":
        case "BooleanLiteral":
        case "TemplateLiteral": {
            return true
        }
        case "Identifier": {
            return node.name === "undefined"
        }
        case "SequenceExpression": {
            return isLiteral(getLastElem(node.expressions))
        }
    }
    return false
}

export function isBlock(node: AnyNode) {
    return is(node, "BlockStatement") || is(node, "TSModuleBlock")
}

export function isUndefinedLiteral(node: AnyNode) {
    return node.type === "Identifier" && node.name === "undefined"
}

// 暂未使用的方法：组件中不支持命名空间声明（若确定未来不会提供支持，可考虑移除此方法）
//
// Currently unused method: namespace declarations are not supported in components
// (if support is confirmed to be unnecessary in the future, consider removing this method).
//
// 判断 TSModuleDeclaration (typescript namespace) 是否会生成 JS 标识符
// 例如：对于没有内种的命名空间声明或只有类型声明的命名空间标识符，在生成的 JS 文件中不存在
//
// Determine whether a TSModuleDeclaration (TypeScript namespace) generates a JavaScript identifier.
// For example, a namespace declaration with no contents or only type declarations will not produce
// a corresponding identifier in the generated JavaScript output.
export function willModuleDeclarationEmitsJS(declaration: TSModuleDeclaration) {
    if (declaration.id.type === "StringLiteral" || declaration.declare) {
        return false
    }
    if (declaration.body.type === "TSModuleDeclaration") {
        return willModuleDeclarationEmitsJS(declaration.body)
    }
    return declaration.body.body.some(statement => {
        switch (statement.type) {
            case "ClassDeclaration":
            case "TSEnumDeclaration":
            case "VariableDeclaration":
            case "FunctionDeclaration": {
                return true
            }
            case "ExportNamedDeclaration": {
                return statement.exportKind === "value"
            }
        }
        return false
    })
}

export function isFunctionLiteral(node: PartialAnyNode) {
    return node && (node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression")
}
