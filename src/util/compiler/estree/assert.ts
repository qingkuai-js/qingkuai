import type { TSModuleDeclaration } from "@babel/types"
import type { AnyNode } from "#type-declarations/estree"

import { stripTypeExpressions } from "./sundry"

export function isLeftValue(node: AnyNode) {
    switch ((node = stripTypeExpressions(node)).type) {
        case "ArrayPattern":
        case "ObjectPattern":
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
    node: AnyNode,
    type: T
): node is AnyNode & { type: T } {
    return node.type === type
}

export function isTypeOperation(node: AnyNode) {
    return (
        node.type === "TSAsExpression" ||
        node.type === "TSTypeAssertion" ||
        node.type === "TSNonNullExpression" ||
        node.type === "TSSatisfiesExpression"
    )
}

export function isLiteral(node: AnyNode | undefined | null) {
    return (
        !node ||
        isUndefinedLiteral(node) ||
        node.type === "NullLiteral" ||
        node.type === "StringLiteral" ||
        node.type === "NumericLiteral"
    )
}

export function isUndefinedLiteral(node: AnyNode) {
    return node.type === "Identifier" && node.name === "undefined"
}

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
