import type { ContextPattern, NamedNode, ScopeBoundary } from "#type-declarations/ts-ast"

import ts from "typescript"

import { any } from "../../util/shared/sundry"
import { stripTypeExpressions } from "./sundry"

// 判断节点是否为类型操作，如 as、<> 等
// Determine whether the node is a type operation, e.g. `as`, `<>`, etc.
export function isTypeOperation(node: ts.Node) {
    return (
        ts.isAsExpression(node) ||
        ts.isTypeAssertionExpression(node) ||
        ts.isNonNullExpression(node) ||
        ts.isSatisfiesExpression(node)
    )
}

export function hasParseError(sourceFile: ts.SourceFile) {
    return any(sourceFile).parseDiagnostics?.length > 0
}

// 判断节点是否为作用域边界
// Determine whether the node is a scope boundary.
export function isScopeBoundary(node: ts.Node): node is ScopeBoundary {
    switch (node.kind) {
        case ts.SyntaxKind.Block:
        case ts.SyntaxKind.SourceFile:
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.CatchClause:
        case ts.SyntaxKind.ModuleBlock: {
            return true
        }
        default: {
            return false
        }
    }
}

export function isContextPattern(node: ts.Node): node is ContextPattern {
    switch (node.kind) {
        case ts.SyntaxKind.Identifier:
        case ts.SyntaxKind.ArrayBindingPattern:
        case ts.SyntaxKind.ObjectBindingPattern: {
            return true
        }
        default: {
            return false
        }
    }
}

// 判断节点是否为更新表达式（++ 或 --）
// Determine whether the node is an update expression (++, --).
export function isUpdateExpression(
    node: ts.Node
): node is ts.PrefixUnaryExpression | ts.PostfixUnaryExpression {
    if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
        if (
            node.operator === ts.SyntaxKind.PlusPlusToken ||
            node.operator === ts.SyntaxKind.MinusMinusToken
        ) {
            return true
        }
    }
    return false
}

// 判断节点是否为赋值表达式
// Determine whether the node is an assignment expression.
export function isAssignmentExpression(node: ts.Node): node is ts.BinaryExpression {
    if (!ts.isBinaryExpression(node)) {
        return false
    }
    switch (node.operatorToken.kind) {
        case ts.SyntaxKind.EqualsToken:
        case ts.SyntaxKind.PlusEqualsToken:
        case ts.SyntaxKind.MinusEqualsToken:
        case ts.SyntaxKind.AsteriskEqualsToken:
        case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
        case ts.SyntaxKind.SlashEqualsToken:
        case ts.SyntaxKind.PercentEqualsToken:
        case ts.SyntaxKind.AmpersandEqualsToken:
        case ts.SyntaxKind.AmpersandAmpersandEqualsToken:
        case ts.SyntaxKind.BarEqualsToken:
        case ts.SyntaxKind.BarBarEqualsToken:
        case ts.SyntaxKind.QuestionQuestionEqualsToken:
        case ts.SyntaxKind.CaretEqualsToken:
        case ts.SyntaxKind.LessThanLessThanEqualsToken:
        case ts.SyntaxKind.GreaterThanGreaterThanEqualsToken:
        case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken: {
            return true
        }
        default: {
            return false
        }
    }
}

// 判断是否为值标识符引用
// Determine whether this is a value identifier reference.
export function isBindingReference(node: ts.Node) {
    if (!ts.isIdentifier(node)) {
        return false
    }
    if (!node.parent) {
        return true
    }
    switch (node.parent.kind) {
        case ts.SyntaxKind.BreakStatement:
        case ts.SyntaxKind.LabeledStatement:
        case ts.SyntaxKind.ContinueStatement:
        case ts.SyntaxKind.ImportSpecifier:
        case ts.SyntaxKind.ImportClause:
        case ts.SyntaxKind.QualifiedName:
        case ts.SyntaxKind.NamespaceImport:
        case ts.SyntaxKind.TypeReference:
        case ts.SyntaxKind.TypeParameter:
        case ts.SyntaxKind.InterfaceDeclaration:
        case ts.SyntaxKind.TypeAliasDeclaration:
        case ts.SyntaxKind.NamespaceExportDeclaration: {
            return false
        }

        case ts.SyntaxKind.Parameter:
        case ts.SyntaxKind.GetAccessor:
        case ts.SyntaxKind.SetAccessor:
        case ts.SyntaxKind.ClassExpression:
        case ts.SyntaxKind.FunctionExpression:
        case ts.SyntaxKind.EnumDeclaration:
        case ts.SyntaxKind.ModuleDeclaration:
        case ts.SyntaxKind.ClassDeclaration:
        case ts.SyntaxKind.MethodDeclaration:
        case ts.SyntaxKind.VariableDeclaration:
        case ts.SyntaxKind.PropertyDeclaration:
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.PropertyAssignment:
        case ts.SyntaxKind.ImportEqualsDeclaration:
        case ts.SyntaxKind.PropertyAccessExpression: {
            return node !== (node.parent as NamedNode).name
        }

        case ts.SyntaxKind.BindingElement: {
            const bindingElement = node.parent as ts.BindingElement
            return node !== bindingElement.propertyName && node !== bindingElement.name
        }
    }
    return true
}

// 判断节点是否为不可提升作用域边界的上下文
// Determine whether the node is within a non-hoistable scope boundary context.
export function isNonHoistableScopeBoundary(node: ts.Node) {
    const parentNode = node.parent
    switch (node.kind) {
        case ts.SyntaxKind.SourceFile:
        case ts.SyntaxKind.ModuleBlock: {
            return true
        }
        case ts.SyntaxKind.Block: {
            switch (parentNode?.kind) {
                case ts.SyntaxKind.GetAccessor:
                case ts.SyntaxKind.SetAccessor:
                case ts.SyntaxKind.Constructor:
                case ts.SyntaxKind.ArrowFunction:
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.MethodDeclaration: {
                    return true
                }
            }
        }
    }
    return ts.isArrowFunction(parentNode) && node === parentNode.body
}

export function isLeftValue(node: ts.Node): boolean {
    node = stripTypeExpressions(node)

    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        return !node.questionDotToken && isLeftValue(node.expression)
    }
    if (ts.isIdentifier(node)) {
        return node.text !== "undefined"
    }
    return false
}

export function isVariableDeclarationListWithVar(node: ts.VariableDeclarationList) {
    return !(
        node.flags & ts.NodeFlags.Let ||
        node.flags & ts.NodeFlags.Const ||
        node.flags & ts.NodeFlags.Using ||
        node.flags & ts.NodeFlags.AwaitUsing
    )
}
