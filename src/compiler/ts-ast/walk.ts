import type {
    NamedNode,
    ScopeBoundary,
    ForStatementLike,
    TsNodeWithContext
} from "#type-declarations/ts-ast"

import ts from "typescript"

import {
    isScopeBoundary,
    isBindingReference,
    isParameterProperty,
    isNonHoistableScopeBoundary
} from "./assert"
import { TestingMode } from "../enums"
import { inputDescriptor } from "../state"
import { getNonHoistableScope } from "./context"
import { objectAssign } from "../../util/shared/aliases"
import { intrinsicMethodsRE, intrinsicVariableRE } from "../regular"
import { getStriptTypeOperationsParent, getVariableDeclareKeyword } from "./sundry"

export function walkAncestors(
    node: TsNodeWithContext,
    callback: (node: TsNodeWithContext) => boolean | void
) {
    for (let current = node.parent; current; current = current.parent) {
        if (callback(current)) {
            break
        }
    }
}

export function walkTsNode(node: ts.Node, callback: (node: ts.Node) => boolean | void) {
    if (callback(node) === true) {
        return true
    }
    for (const child of node.getChildren()) {
        if (walkTsNode(child, callback) === true) {
            return true
        }
    }
}

export function walkTsNodeWithContext(node: ts.Node, callback: (node: TsNodeWithContext) => void) {
    callback(attchContextToNode(node))
    ts.forEachChild(node, child => {
        walkTsNodeWithContext(child, callback)
    })
}

// 递归遍历一个 BindingName 节点，当遇到绑定标识符时，调用传入的 callback，并传入当前标识符节点及其访问路径
// Recursively traverse a BindingName node. When a binding identifier is encountered, invoke the
// provided callback with the current identifier node and its access path.
//
// 注意：通过此方法分析解构模式的访问路径时，只有模式中未使用剩余元素语法才能得到精确的静态访问路径
// Note: When analyzing access paths of destructuring patterns using this method,
// precise static access paths can only be obtained if the pattern does not use rest elements.
export function walkBindingNameIdentifiers(
    pattern: ts.BindingName,
    callback: (id: ts.Identifier, path: string) => void
) {
    const result = {
        hasRestElement: false,
        specifiedDefaultValue: false
    }

    ;(function extract(from: ts.BindingName, path: string): void | boolean {
        if (ts.isIdentifier(from)) {
            return callback(from, path)
        }

        for (const element of from.elements) {
            if (!ts.isOmittedExpression(element)) {
                result.hasRestElement ||= !!element.dotDotDotToken
                result.specifiedDefaultValue ||= !!element.initializer
            }
        }

        if (ts.isArrayBindingPattern(from)) {
            for (let i = 0; i < from.elements.length; i++) {
                const element = from.elements[i]
                if (ts.isOmittedExpression(element)) {
                    continue
                }
                if (element.dotDotDotToken) {
                    extract(element.name, path)
                } else {
                    extract(element.name, path + `[${i}]`)
                }
            }
            return
        }

        if (ts.isObjectBindingPattern(from)) {
            for (const property of from.elements) {
                if (property.dotDotDotToken) {
                    extract(property.name, path)
                } else {
                    let extra = ""
                    if (property.propertyName) {
                        if (ts.isIdentifier(property.propertyName)) {
                            extra = `.${property.propertyName.text}`
                        }
                    } else if (ts.isIdentifier(property.name)) {
                        extra = `.${property.name.text}`
                    }
                    extract(property.name, path + extra)
                }
            }
            return
        }
    })(pattern, "")

    return result
}

function attchContextToNode(node: ts.Node) {
    let inTopLevel: boolean
    let scopeIdentifiers: Set<string> | undefined

    const nodeWithContext = node as TsNodeWithContext
    const currentIsScopeBoundary = isScopeBoundary(node)
    const contextedParent = nodeWithContext.parent as TsNodeWithContext | null
    if (!ts.isSourceFile(nodeWithContext)) {
        if (!currentIsScopeBoundary) {
            scopeIdentifiers = contextedParent?.scopeIdentifiers
        } else {
            scopeIdentifiers = new Set(contextedParent?.scopeIdentifiers)
        }
    }

    if (!contextedParent || ts.isSourceFile(contextedParent)) {
        inTopLevel = true
    } else {
        inTopLevel = contextedParent.inTopLevel && !contextedParent.isScopeBoundary
    }

    objectAssign(nodeWithContext, {
        inTopLevel,
        scopeIdentifiers,
        isScopeBoundary: currentIsScopeBoundary,
        isBindingReference: isBindingReference(nodeWithContext),
        isNonHoistableScopeBoundary: isNonHoistableScopeBoundary(nodeWithContext)
    })

    if (currentIsScopeBoundary && !ts.isSourceFile(nodeWithContext)) {
        recordScopeIdentifiers(nodeWithContext as TsNodeWithContext<ScopeBoundary>)
    }
    return nodeWithContext
}

// 记录上下文中含有的作用域标识符
// Record the scope identifiers present in the context.
function recordScopeIdentifiers(node: TsNodeWithContext<ScopeBoundary>) {
    const patterns: ts.BindingName[] = []
    const declarations: ts.VariableDeclaration[] = []
    const parent = getStriptTypeOperationsParent(node, false)! as ts.Node
    const statements = "statements" in node ? node.statements : [node]

    const extendScopeIdentifiers = (scope: TsNodeWithContext, id: ts.Identifier) => {
        if (
            intrinsicMethodsRE.test(id.text) ||
            intrinsicVariableRE.test(id.text) ||
            inputDescriptor.options.testing === TestingMode.Unit
        ) {
            ;(scope.scopeIdentifiers ??= new Set()).add(id.text)
        }
    }

    switch (parent.kind) {
        case ts.SyntaxKind.CatchClause: {
            const catchClause = parent as ts.CatchClause
            if (catchClause.variableDeclaration && catchClause.variableDeclaration.name) {
                patterns.push(catchClause.variableDeclaration.name)
            }
            break
        }

        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement: {
            const statement = parent as ForStatementLike
            if (statement.initializer && ts.isVariableDeclarationList(statement.initializer)) {
                statement.initializer.declarations.forEach(decl => declarations.push(decl))
            }
            break
        }

        case ts.SyntaxKind.EnumDeclaration:
        case ts.SyntaxKind.ClassExpression:
        case ts.SyntaxKind.ClassDeclaration:
        case ts.SyntaxKind.FunctionExpression:
        case ts.SyntaxKind.FunctionDeclaration: {
            const namedNode = parent as NamedNode
            if (namedNode.name && ts.isIdentifier(namedNode.name)) {
                extendScopeIdentifiers(node, namedNode.name)
            }
            // fallthrough
        }

        default: {
            if ("parameters" in parent) {
                for (const parameter of parent.parameters as ts.NodeArray<ts.ParameterDeclaration>) {
                    if (ts.isConstructorDeclaration(parent) && isParameterProperty(parameter)) {
                        continue
                    }
                    patterns.push(parameter.name)
                }
            }
        }
    }
    for (const pattern of patterns) {
        walkBindingNameIdentifiers(pattern, identifier => {
            extendScopeIdentifiers(node, identifier)
        })
    }
    for (const statement of statements) {
        switch (statement.kind) {
            case ts.SyntaxKind.VariableStatement: {
                const declarationList = (statement as ts.VariableStatement).declarationList
                for (const declaration of declarationList.declarations) {
                    declarations.push(declaration)
                }
                break
            }

            case ts.SyntaxKind.ModuleDeclaration: {
                // @ts-expect-error: access private method (check emit)
                if (ts.getModuleInstanceState(statement) === 0) {
                    break
                }
                // fallthrough
            }

            case ts.SyntaxKind.EnumDeclaration:
            case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.FunctionDeclaration: {
                const namedNode = statement as NamedNode
                if (namedNode.name && ts.isIdentifier(namedNode.name)) {
                    extendScopeIdentifiers(node, namedNode.name)
                }
                break
            }
        }
    }
    for (const declaration of declarations) {
        walkBindingNameIdentifiers(declaration.name, identifier => {
            let scopeNode: TsNodeWithContext = node
            const declareKeyword = getVariableDeclareKeyword(
                declaration.parent as ts.VariableDeclarationList
            )
            if (declareKeyword === "var" && !node.isNonHoistableScopeBoundary) {
                scopeNode = getNonHoistableScope(node)!
            }
            if (!ts.isSourceFile(scopeNode)) {
                extendScopeIdentifiers(scopeNode, identifier)
            }
        })
    }
}
