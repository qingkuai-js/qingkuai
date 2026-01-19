import type {
    LVal,
    Program,
    Identifier,
    PatternLike,
    TSModuleBlock,
    BlockStatement,
    VariableDeclaration,
    Expression
} from "@babel/types"
import type { AnyNode, Visitor, WalkPatternCallback, WithLoc } from "#type-declarations/estree"

import { any } from "../../shared/sundry"
import { isArray, isObject } from "../../shared/assert"
import { isTypeOperation, willModuleDeclarationEmitsJS } from "./assert"

export class WalkContext<T extends AnyNode = AnyNode> {
    inTopLevel: boolean
    isBindingReference: boolean

    constructor(
        public value: T,
        public parent: WalkContext | null = null,
        public scopeIdentifiers: Set<string> = new Set()
    ) {
        const blockTypes = ["BlockStatement", "TSModuleBlock"]
        this.isBindingReference = isBindingReference(this)
        blockTypes.includes(value.type) && recordScopeIdentifiers(any(this))
        this.inTopLevel = !parent || (parent.inTopLevel && !blockTypes.includes(parent.value.type))
    }

    // 节点是否处于可提升的顶级作用域（含非函数块级作用域）
    // Whether the node is in a hoistable top-level scope (including non-function block scopes).
    get inHoistableTopLevel() {
        let ret = true
        this.walkAncestors(current => {
            if (isNonHoistableScopeContext(current)) {
                return (ret = current.value.type === "Program"), true
            }
        })
        return ret
    }

    // 节点是否为简写标识符，如 { a } 等
    // Whether the node is a shorthand identifier, e.g. `{ a }`.
    get isShorthandIdentifier() {
        if (this.value.type !== "Identifier") {
            return false
        }
        return !!any(this.parent?.value).shorthand
    }

    // 节点是否为计算标识符，如 { [a]: 1 } 等
    // Whether the node is a computed identifier, e.g. `{ [a]: 1 }`.
    get isComputedIdentifier() {
        if (this.value.type !== "Identifier") {
            return false
        }
        return !!any(this.parent?.value).computed
    }

    // 节点是否为函数参数中的标识符，如 { _: (a) {} } 等
    // Whether the node is an identifier within function parameters, e.g. `{ _: (a) {} }`.
    get isParameterIdentifier() {
        if (this.value.type !== "Identifier") {
            return false
        }

        const parentNode = this.parent?.value
        if (!parentNode || !("params" in parentNode)) {
            return false
        }
        for (const param of parentNode.params) {
            if (this.value === param) {
                return true
            }
        }
        return false
    }

    get striptTypeOperationsParent(): WalkContext<AnyNode> | null {
        if (!this.parent) {
            return null
        }
        if (!isTypeOperation(this.parent.value)) {
            return this.parent
        }
        return this.parent.striptTypeOperationsParent
    }

    // 获取节点所属的作用域
    // Get the scope that the node belongs to.
    get scope(): WalkContext<BlockStatement | TSModuleBlock | Program> | null {
        let ret: any = null
        this.walkAncestors(current => {
            if (isScopeContext(current)) {
                return (ret = current), true
            }
        })
        return ret
    }

    // 获取节点所属的不可提升作用域
    // Get the non-hoistable scope that the node belongs to.
    get nonHoistableScope(): WalkContext<BlockStatement | TSModuleBlock | Program> | null {
        let ret: any = null
        this.walkAncestors(current => {
            if (isNonHoistableScopeContext(current)) {
                return (ret = current), true
            }
        })
        return ret
    }

    findAncestorUntil<T extends AnyNode["type"]>(
        type: T
    ): WalkContext<AnyNode & { type: T }> | null {
        let ret: any = null
        this.walkAncestors(current => {
            if (type === current.value.type) {
                return (ret = current), true
            }
        })
        return ret
    }

    walkAncestors(callback: (context: WalkContext) => any) {
        for (let current = this.parent; current; current = current.parent) {
            if (callback(current)) {
                break
            }
        }
    }
}

export function walk(node: any, visitor: Visitor, context = new WalkContext(node)) {
    const recursive = (child: AnyNode) => {
        if (child.loc) {
            const scopeIdentifiers = new Set(context.scopeIdentifiers)
            walk(child, visitor, new WalkContext(child, context, scopeIdentifiers))
        }
    }

    visitor.AnyNode?.(node, context)
    any(visitor)[node.type]?.(node, context)

    for (const key of Object.keys(node)) {
        if (key === "loc" || key === "range") {
            continue
        }

        const child = node[key]
        if (isArray(child)) {
            child.forEach(recursive)
        } else if (isObject(child)) {
            recursive(any(child))
        }
    }
}

export function walkPatternIdentifiers(pattern: LVal | PatternLike, callback: WalkPatternCallback) {
    return (function extract(from: LVal | PatternLike, path: string): void | boolean {
        switch (from.type) {
            case "Identifier": {
                return callback(from as WithLoc<Identifier>, path)
            }
            case "AssignmentPattern": {
                return extract(from.left, path), true
            }
            case "RestElement": {
                return extract(from.argument, path)
            }
            case "ArrayPattern": {
                return from.elements.reduce((ret, element, index) => {
                    return (element && extract(element, path + `[${index}]`)) || ret
                }, false)
            }
            case "ObjectPattern": {
                return from.properties.reduce((ret, property) => {
                    if (property.type === "RestElement") {
                        return extract(property, path) || ret
                    } else {
                        let extra = ""
                        if (property.key.type === "Identifier") {
                            extra = `.${property.key.name}`
                        }
                        return extract(property.value as PatternLike, path + extra) || ret
                    }
                }, false)
            }
        }
    })(pattern, "")
}

// 判断节点是否为作用域块的上下文
// Determine whether the node is within a scope block context.
function isScopeContext(context: WalkContext) {
    switch (context.value.type) {
        case "Program":
        case "TSModuleBlock":
        case "BlockStatement": {
            return true
        }
    }
    return false
}

// 判断节点是否为不可提升作用域块的上下文
// Determine whether the node is within a non-hoistable scope block context.
function isNonHoistableScopeContext(context: WalkContext) {
    switch (context.value.type) {
        case "Program":
        case "TSModuleBlock": {
            return true
        }
        case "BlockStatement": {
            switch (context.parent?.value.type) {
                case "ObjectMethod":
                case "ClassMethod":
                case "ClassPrivateMethod":
                case "FunctionExpression":
                case "FunctionDeclaration":
                case "ArrowFunctionExpression": {
                    return true
                }
            }
        }
    }
    return false
}

// 判断是否为值标识符引用
// Determine whether this is a value identifier reference.
function isBindingReference(context: WalkContext) {
    const node = context.value
    const parent = context.parent
    const parentNode = parent?.value
    const assertedContext = context as WalkContext<Identifier>
    if (!parentNode || node.type !== "Identifier") {
        return false
    }
    switch (parentNode.type) {
        case "BreakStatement":
        case "LabeledStatement":
        case "ContinueStatement":
        case "PrivateName":
        case "ArrowFunctionExpression":
        case "ImportSpecifier":
        case "ImportDefaultSpecifier":
        case "ImportNamespaceSpecifier":
        case "TSTypeReference":
        case "TSQualifiedName":
        case "TSEnumDeclaration":
        case "TSModuleDeclaration":
        case "TSInterfaceDeclaration":
        case "TSTypeAliasDeclaration":
        case "TSExpressionWithTypeArguments": {
            return false
        }

        case "AssignmentPattern": {
            return node !== parentNode.left
        }

        case "CatchClause": {
            return node !== parentNode.param
        }

        case "MemberExpression":
        case "OptionalMemberExpression": {
            return parentNode.computed || node !== parentNode.property
        }

        case "ObjectMethod":
        case "ClassMethod":
        case "ClassProperty":
        case "ClassPrivateMethod":
        case "ClassPrivateProperty":
        case "ClassAccessorProperty": {
            return (
                !assertedContext.isParameterIdentifier &&
                (node !== parentNode.key || assertedContext.isComputedIdentifier)
            )
        }

        case "ClassExpression":
        case "ClassDeclaration":
        case "VariableDeclarator":
        case "FunctionExpression":
        case "FunctionDeclaration": {
            return !assertedContext.isParameterIdentifier && node !== parentNode.id
        }

        case "RestElement":
        case "ArrayPattern":
        case "ObjectPattern":
        case "ObjectProperty": {
            let ret = false
            let isAssignTargetPattern = false
            let patternContext: WalkContext<PatternLike> | undefined
            if (parentNode.type !== "ObjectProperty" && parentNode.type !== "RestElement") {
                patternContext = any(parent)
            } else {
                parent.walkAncestors(current => {
                    switch (current.value.type) {
                        case "ArrayExpression":
                        case "ObjectExpression": {
                            if (parentNode.type === "ObjectProperty") {
                                ret = parentNode.computed || node === parentNode.value
                            }
                            return true
                        }
                        case "ArrayPattern":
                        case "ObjectPattern": {
                            return (patternContext = any(current)), true
                        }
                    }
                })
            }
            patternContext?.walkAncestors(current => {
                switch (current.value.type) {
                    case "CatchClause":
                    case "ObjectMethod":
                    case "ClassMethod":
                    case "ClassPrivateMethod":
                    case "ImportDeclaration":
                    case "VariableDeclarator":
                    case "FunctionExpression":
                    case "FunctionDeclaration":
                    case "ArrowFunctionExpression": {
                        return true
                    }
                    case "ForOfStatement":
                    case "ForInStatement":
                    case "AssignmentExpression": {
                        return (isAssignTargetPattern = true)
                    }
                }
            })
            if (isAssignTargetPattern) {
                walkPatternIdentifiers(patternContext!.value, identifier => {
                    ret ||= node === identifier
                })
            }
            return ret
        }
    }
    return true
}

// 记录上下文中含有的作用域标识符
// Record the scope identifiers present in the context.
function recordScopeIdentifiers(context: WalkContext<BlockStatement | TSModuleBlock>) {
    const node = context.value
    const paramPatterns: PatternLike[] = []
    const declarations: VariableDeclaration[] = []
    const parentNode = context.striptTypeOperationsParent!.value
    switch (parentNode.type) {
        case "CatchClause": {
            if (parentNode.param) {
                paramPatterns.push(parentNode.param)
            }
            break
        }

        case "ForInStatement":
        case "ForOfStatement": {
            if (parentNode.left.type === "VariableDeclaration") {
                declarations.push(parentNode.left)
            }
            break
        }
        case "ForStatement": {
            if (parentNode.init?.type === "VariableDeclaration") {
                declarations.push(parentNode.init)
            }
            break
        }

        case "FunctionExpression": {
            if (parentNode.id?.type === "Identifier") {
                context.scopeIdentifiers.add(parentNode.id.name)
            }
            // fallthrough
        }
        case "ObjectMethod":
        case "ClassMethod":
        case "ClassPrivateMethod":
        case "FunctionDeclaration":
        case "ArrowFunctionExpression": {
            for (const param of parentNode.params) {
                if (param.type !== "TSParameterProperty") {
                    paramPatterns.push(param)
                } else {
                    paramPatterns.push(param.parameter)
                }
            }
            break
        }
    }
    for (const pattern of paramPatterns) {
        walkPatternIdentifiers(pattern, identifier => {
            context.scopeIdentifiers.add(identifier.name)
        })
    }
    for (const statement of node.body) {
        switch (statement.type) {
            case "VariableDeclaration": {
                declarations.push(statement)
                break
            }
            case "TSModuleDeclaration": {
                if (!willModuleDeclarationEmitsJS(statement)) {
                    break
                }
                // fallthrough
            }
            case "ClassDeclaration":
            case "TSEnumDeclaration":
            case "FunctionDeclaration": {
                if (statement.id?.type === "Identifier") {
                    context.scopeIdentifiers.add(statement.id.name)
                }
                break
            }
        }
    }
    for (const declaration of declarations) {
        for (const declarator of declaration.declarations) {
            walkPatternIdentifiers(declarator.id, identifier => {
                let scope: WalkContext | null = context
                if (declaration.kind === "var" && !isNonHoistableScopeContext(context)) {
                    scope = context.nonHoistableScope
                }
                scope?.scopeIdentifiers.add(identifier.name)
            })
        }
    }
}
