import type { NamedNode, ScopeBoundary } from "#type-declarations/ts-ast"

import ts from "typescript"

import { any } from "../../util/shared/sundry"
import { getStriptTypeOperationsNode, getStriptTypeOperationsParent } from "./sundry"

// 判断节点是否为类型操作，如 as、<> 等
// Determine whether the node is a type operation, e.g. `as`, `<>`, etc.
export function isTypeOperation(node: ts.Node) {
    return (
        ts.isAsExpression(node) ||
        ts.isNonNullExpression(node) ||
        ts.isSatisfiesExpression(node) ||
        ts.isTypeAssertionExpression(node)
    )
}

export function hasParseError(sourceFile: ts.SourceFile) {
    return any(sourceFile).parseDiagnostics?.length > 0
}

export function isLiteral(node: ts.Node) {
    switch (node.kind) {
        case ts.SyntaxKind.TrueKeyword:
        case ts.SyntaxKind.FalseKeyword:
        case ts.SyntaxKind.NullKeyword:
        case ts.SyntaxKind.BigIntLiteral:
        case ts.SyntaxKind.StringLiteral:
        case ts.SyntaxKind.NumericLiteral:
        case ts.SyntaxKind.ClassExpression:
        case ts.SyntaxKind.RegularExpressionLiteral:
        case ts.SyntaxKind.NoSubstitutionTemplateLiteral: {
            return true
        }
        case ts.SyntaxKind.Identifier: {
            return (node as ts.Identifier).text === "undefined"
        }
        case ts.SyntaxKind.BinaryExpression: {
            const binaryExpression = node as ts.BinaryExpression
            if (binaryExpression.operatorToken.kind === ts.SyntaxKind.CommaToken) {
                return isLiteral(binaryExpression.right)
            }
        }
    }
    return false
}

export function isValidContextPattern(node: ts.ArrayBindingElement) {
    return ts.isOmittedExpression(node) || !node.dotDotDotToken
}

export function isParameterProperty(param: ts.ParameterDeclaration) {
    return !!param.modifiers?.some(mod => {
        return (
            mod.kind === ts.SyntaxKind.PublicKeyword ||
            mod.kind === ts.SyntaxKind.PrivateKeyword ||
            mod.kind === ts.SyntaxKind.ReadonlyKeyword ||
            mod.kind === ts.SyntaxKind.ProtectedKeyword
        )
    })
}

export function isFunctionLiteral(node: ts.Node) {
    return ts.isFunctionExpression(node) || ts.isArrowFunction(node)
}

// 判断节点是否为括号表达式的最后一个节点
// Determine whether the node is the last node of a parenthesized expression.
export function isLastNodeOfParenthesis(node: ts.Node) {
    if (!node.parent) {
        return false
    }
    if (ts.isParenthesizedExpression(node.parent)) {
        return true
    }
    if (
        ts.isBinaryExpression(node.parent) &&
        node.parent.operatorToken.kind === ts.SyntaxKind.CommaToken
    ) {
        return node.parent.right === node
    }
    return false
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

        case ts.SyntaxKind.ExpressionWithTypeArguments: {
            const grandParent = node.parent.parent
            if (ts.isHeritageClause(grandParent)) {
                return grandParent.token === ts.SyntaxKind.ExtendsKeyword
            }
            break
        }

        case ts.SyntaxKind.BindingElement: {
            const bindingElement = node.parent as ts.BindingElement
            return node !== bindingElement.propertyName && node !== bindingElement.name
        }
    }
    return true
}

// 判断节点是否为作用域边界
// Determine whether the node is a scope boundary.
export function isScopeBoundary(node: ts.Node): node is ScopeBoundary {
    switch (node.kind) {
        case ts.SyntaxKind.Block:
        case ts.SyntaxKind.SourceFile:
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.ModuleBlock:
        case ts.SyntaxKind.ClassExpression:
        case ts.SyntaxKind.ClassDeclaration: {
            return true
        }
        default: {
            const parentNode = node.parent
            switch (parentNode.kind) {
                case ts.SyntaxKind.ArrowFunction: {
                    const arrowFunction = parentNode as ts.ArrowFunction
                    return node === arrowFunction.body
                }
                case ts.SyntaxKind.ForStatement: {
                    const forStatement = parentNode as ts.ForStatement
                    return (
                        node === forStatement.statement ||
                        node === forStatement.condition ||
                        node === forStatement.incrementor
                    )
                }
                case ts.SyntaxKind.ForInStatement:
                case ts.SyntaxKind.ForOfStatement: {
                    const forInOrOfStatement = parentNode as ts.ForInStatement | ts.ForOfStatement
                    return node === forInOrOfStatement.statement
                }
                default: {
                    return false
                }
            }
        }
    }
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
    if (ts.isSourceFile(node)) {
        return false
    }
    node = getStriptTypeOperationsNode(node)!

    if (isMemberAccessExpression(node)) {
        return !node.questionDotToken && isLeftValue(node.expression)
    }
    if (ts.isIdentifier(node)) {
        return node.text !== "undefined"
    }
    return false
}

export function isInlineEventHandler(node: ts.Node) {
    switch (node.kind) {
        case ts.SyntaxKind.Identifier:
        case ts.SyntaxKind.ArrowFunction:
        case ts.SyntaxKind.FunctionExpression:
        case ts.SyntaxKind.ElementAccessExpression:
        case ts.SyntaxKind.PropertyAccessExpression: {
            return false
        }
        default: {
            return true
        }
    }
}

export function isSimpleHandlerReference(node: ts.Node) {
    switch (node.kind) {
        case ts.SyntaxKind.Identifier:
        case ts.SyntaxKind.PropertyAccessExpression:
        case ts.SyntaxKind.ElementAccessExpression: {
            return true
        }
        default: {
            return false
        }
    }
}

export function isPropertyEqual(a: ts.Node, b: ts.Node): boolean {
    const [x, y] = [a, b].map(node => {
        switch ((node = getStriptTypeOperationsParent(node)!).kind) {
            case ts.SyntaxKind.Identifier: {
                return (node as ts.Identifier).text
            }
            case ts.SyntaxKind.StringLiteral:
            case ts.SyntaxKind.NumericLiteral:
            case ts.SyntaxKind.NoSubstitutionTemplateLiteral: {
                return String((node as ts.LiteralExpression).text)
            }
            default: {
                return null
            }
        }
    })
    return x !== null && y !== null && x === y
}

export function isExpressionEqual(a: ts.Node, b: ts.Node): boolean {
    ;[a, b] = [a, b].map(node => getStriptTypeOperationsParent(node)!)

    if (a.kind !== b.kind) {
        return false
    }

    switch (a.kind) {
        case ts.SyntaxKind.Identifier: {
            return any(a).text === any(b).name
        }
        case ts.SyntaxKind.PropertyAccessExpression: {
            return (
                isPropertyEqual(any(a).name, any(b).name) &&
                isExpressionEqual(any(a).expression, any(b).expression)
            )
        }
        case ts.SyntaxKind.ElementAccessExpression: {
            return (
                isExpressionEqual(any(a).expression, any(b).expression) &&
                isExpressionEqual(any(a).argumentExpression, any(b).argumentExpression)
            )
        }
        default: {
            return false
        }
    }
}

export function isMemberAccessExpression(node: ts.Node) {
    return ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)
}
