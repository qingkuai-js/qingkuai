import type { TsWalkContext as TsWalkContextImpl } from "#type-declarations/compiler"
import type { ContextPattern, ForStatementLike, NamedNode } from "#type-declarations/ts-ast"

import {
    isScopeBoundary,
    isBindingReference,
    isUpdateExpression,
    isAssignmentExpression,
    isNonHoistableScopeBoundary,
    isVariableDeclarationListWithVar
} from "./assert"
import ts from "typescript"
import { striptTypeOperationsParent } from "./sundry"
import { intrinsicMethodsRE, intrinsicVariableRE } from "../regular"

export function walkTsNodeWithContext(
    node: ts.Node,
    context: TsWalkContextImpl | null = null,
    callback: (context: TsWalkContextImpl) => void
) {
    const parentContext = new TsWalkContext(node, context)
    callback(new TsWalkContext(node, context, context?.scopeIdentifiers))
    ts.forEachChild(node, child => {
        const childContext = new TsWalkContext(
            child,
            parentContext,
            new Set(parentContext.scopeIdentifiers)
        )
        walkTsNodeWithContext(child, childContext, callback)
    })
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

// 递归遍历一个 Pattern 节点，当遇到绑定标识符时，调用传入的 callback，并传入当前标识符节点及其访问路径
// Recursively traverse a Pattern node. When a binding identifier is encountered, invoke the
// provided callback with the current identifier node and its access path.
//
// 注意：通过此方法分析解构模式的访问路径时，只有模式中未使用剩余元素语法才能得到精确的静态访问路径
// Note: When analyzing access paths of destructuring patterns using this method,
// precise static access paths can only be obtained if the pattern does not use rest elements.
export function walkPatternIdentifiers(
    pattern: ContextPattern,
    callback: (id: ts.Identifier, path: string) => void
) {
    const result = {
        hasRestElement: false,
        specifiedDefaultValue: false
    }

    ;(function extract(from: ContextPattern, path: string): void | boolean {
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

class TsWalkContext<T extends ts.Node = ts.Node> implements TsWalkContextImpl<T> {
    inTopLevel: boolean
    isScopeBoundary: boolean
    isBindingReference: boolean
    isNonHoistableScopeBoundary: boolean

    constructor(
        public value: T,
        public parent: TsWalkContextImpl | null = null,
        public scopeIdentifiers: Set<string> | undefined = undefined
    ) {
        this.isScopeBoundary = isScopeBoundary(value)
        this.isBindingReference = isBindingReference(value)
        this.isNonHoistableScopeBoundary = isNonHoistableScopeBoundary(value)
        this.inTopLevel = !parent || (parent.inTopLevel && !parent.isScopeBoundary)

        if (!ts.isSourceFile(value) && this.isScopeBoundary) {
            recordScopeIdentifiers(this)
        }
    }

    // 判断节点是否为标识符形式的赋值目标
    // Determine whether the node is an identifier-form assignment target.
    get isIdentifierAssignmentTarget() {
        if (!this.isBindingReference) {
            return false
        }

        let ret = false
        const nodeEnd = this.value.end
        this.walkAncestors(({ value }) => {
            if (ts.isNonNullExpression(value)) {
                return
            }
            if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) {
                return true
            }
            if (isUpdateExpression(value)) {
                return (ret = true)
            }
            if (isAssignmentExpression(value)) {
                return (ret = nodeEnd <= value.operatorToken.getStart())
            }
        })
        return ret
    }

    // 获取节点所属的作用域
    // Get the scope that the node belongs to.
    get scope(): TsWalkContext | null {
        let ret: any = null
        this.walkAncestors(current => {
            if (current.isScopeBoundary) {
                return ((ret = current), true)
            }
        })
        return ret
    }

    // 获取节点所属的不可提升作用域
    // Get the non-hoistable scope that the node belongs to.
    get nonHoistableScope(): TsWalkContext | null {
        let ret: any = null
        this.walkAncestors(current => {
            if (current.isNonHoistableScopeBoundary) {
                return ((ret = current), true)
            }
        })
        return ret
    }

    // 节点是否处于可提升的顶级作用域（含非函数块级作用域）
    // Whether the node is in a hoistable top-level scope (including non-function block scopes).
    get inHoistableTopLevel() {
        let ret = true
        this.walkAncestors(current => {
            if (current.isNonHoistableScopeBoundary) {
                return ((ret = ts.isSourceFile(current.value)), true)
            }
        })
        return ret
    }

    walkAncestors(callback: (context: TsWalkContextImpl) => boolean | void) {
        for (let current = this.parent; current; current = current.parent) {
            if (callback(current)) {
                break
            }
        }
    }
}

// 记录上下文中含有的作用域标识符
// Record the scope identifiers present in the context.
function recordScopeIdentifiers(context: TsWalkContext) {
    const node = context.value
    const patterns: ContextPattern[] = []
    const declarations: ts.VariableDeclaration[] = []
    const parentNode = striptTypeOperationsParent(context.value)!
    const statements = isScopeBoundary(node) ? node.statements : [node]

    const extendScopeIdentifiers = (context: TsWalkContext, id: ts.Identifier) => {
        if (
            process.env.VITEST === "true" ||
            intrinsicMethodsRE.test(id.text) ||
            intrinsicVariableRE.test(id.text)
        ) {
            ;(context.scopeIdentifiers ??= new Set()).add(id.text)
        }
    }

    switch (parentNode.kind) {
        case ts.SyntaxKind.CatchClause: {
            const catchClause = parentNode as ts.CatchClause
            if (catchClause.variableDeclaration && catchClause.variableDeclaration.name) {
                patterns.push(catchClause.variableDeclaration.name)
            }
            break
        }

        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement: {
            const statement = parentNode as ForStatementLike
            if (statement.initializer && ts.isVariableDeclarationList(statement.initializer)) {
                patterns.push(...statement.initializer.declarations.map(decl => decl.name))
            }
            break
        }

        case ts.SyntaxKind.ClassExpression:
        case ts.SyntaxKind.FunctionExpression: {
            const expression = parentNode as ts.ClassExpression | ts.FunctionExpression
            if (expression.name) {
                extendScopeIdentifiers(context, expression.name)
            }
            // fallthrough
        }

        default: {
            if ("parameters" in parentNode && ts.isParameter(parentNode)) {
                patterns.push(parentNode.name)
            }
        }
    }
    for (const pattern of patterns) {
        walkPatternIdentifiers(pattern, identifier => {
            extendScopeIdentifiers(context, identifier)
        })
    }
    for (const statement of statements) {
        switch (statement.kind) {
            case ts.SyntaxKind.VariableDeclarationList: {
                const declarationList = statement as ts.VariableDeclarationList
                for (const declaration of declarationList.declarations) {
                    declarations.push(declaration)
                }
                break
            }
            case ts.SyntaxKind.EnumDeclaration:
            case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.ModuleDeclaration:
            case ts.SyntaxKind.FunctionDeclaration: {
                const namedNode = statement as NamedNode
                if (namedNode.name && ts.isIdentifier(namedNode.name)) {
                    extendScopeIdentifiers(context, namedNode.name)
                }
                break
            }
        }
    }
    for (const declaration of declarations) {
        walkPatternIdentifiers(declaration.name, identifier => {
            let scopeContext: TsWalkContext = context
            const isVar = isVariableDeclarationListWithVar(
                declaration.parent as ts.VariableDeclarationList
            )
            if (isVar && !context.isNonHoistableScopeBoundary) {
                scopeContext = context.nonHoistableScope!
            }
            if (!ts.isSourceFile(scopeContext.value)) {
                extendScopeIdentifiers(scopeContext, identifier)
            }
        })
    }
}
