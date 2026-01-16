import type { TSModuleDeclaration } from "@babel/types"
import type { AnyNode } from "#type-declarations/estree"

export function is<T extends AnyNode["type"]>(
    node: AnyNode,
    type: T
): node is AnyNode & { type: T } {
    return node.type === type
}

export function isTypeExpression(node: AnyNode) {
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
