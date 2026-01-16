import type {
    LVal,
    Identifier,
    PatternLike,
    TSModuleBlock,
    BlockStatement,
    VariableDeclaration
} from "@babel/types"
import type { AnyNode, Visitor, WithLoc } from "#type-declarations/estree"

import { any } from "../../shared/sundry"
import { isArray, isObject } from "../../shared/assert"
import { isTypeExpression, willModuleDeclarationEmitsJS } from "./assert"

export class WalkContext<T extends AnyNode = AnyNode> {
    inTopLevel: boolean
    isBindingReference: boolean

    constructor(
        public value: T,
        public parent: WalkContext | null = null,
        public blockIdentifiers: Set<string> = new Set()
    ) {
        const blockTypes = ["BlockStatement", "TSModuleBlock"]
        this.isBindingReference = isBindingReference(this)
        blockTypes.includes(value.type) && recordBlockIdentifiers(any(this))
        this.inTopLevel = !parent || (parent.inTopLevel && !blockTypes.includes(parent.value.type))
    }

    get inHoistTopLevel() {
        let ret = true
        this.walkAncestors(current => {
            switch (current.value.type) {
                case "ObjectMethod":
                case "ClassMethod":
                case "ClassPrivateMethod":
                case "FunctionExpression":
                case "FunctionDeclaration":
                case "ArrowFunctionExpression": {
                    return (ret = false), true
                }
            }
        })
        return ret
    }

    get isComputedIdentifier() {
        if (this.value.type !== "Identifier") {
            return false
        }
        return !!any(this.parent?.value).computed
    }

    get isShorthandIdentifier() {
        if (this.value.type !== "Identifier") {
            return false
        }
        return !!any(this.parent?.value).shorthand
    }

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

    get striptTypeExpressionsParent(): WalkContext<AnyNode> | null {
        if (!this.parent) {
            return null
        }
        if (!isTypeExpression(this.parent.value)) {
            return this.parent
        }
        return this.parent.striptTypeExpressionsParent
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

export function walkDeclarationIdentifiers(
    pattern: LVal | PatternLike,
    callback: (identifier: WithLoc<Identifier>) => void
) {
    switch (pattern.type) {
        case "Identifier": {
            return callback(pattern as WithLoc<Identifier>)
        }
        case "AssignmentPattern": {
            return walkDeclarationIdentifiers(pattern.left, callback)
        }
        case "RestElement": {
            return walkDeclarationIdentifiers(pattern.argument, callback)
        }
        case "ArrayPattern": {
            for (const element of pattern.elements) {
                element && walkDeclarationIdentifiers(element, callback)
            }
            break
        }
        case "ObjectPattern": {
            for (const property of pattern.properties) {
                if (property.type === "RestElement") {
                    walkDeclarationIdentifiers(property, callback)
                } else {
                    walkDeclarationIdentifiers(property.value as PatternLike, callback)
                }
            }
            break
        }
    }
}

export function walk(node: any, visitor: Visitor, context = new WalkContext(node)) {
    const recursive = (child: AnyNode) => {
        if (child.loc) {
            const blockIdentifiers = new Set(context.blockIdentifiers)
            walk(child, visitor, new WalkContext(child, context, blockIdentifiers))
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
        case "PrivateName":
        case "ImportSpecifier":
        case "BreakStatement":
        case "LabeledStatement":
        case "ContinueStatement":
        case "ArrowFunctionExpression":
        case "TSTypeReference":
        case "TSQualifiedName":
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
                walkDeclarationIdentifiers(patternContext!.value, identifier => {
                    ret ||= node === identifier
                })
            }
            return ret
        }
    }
    return true
}

function recordBlockIdentifiers(context: WalkContext<BlockStatement | TSModuleBlock>) {
    const paramPatterns: PatternLike[] = []
    const declarations: VariableDeclaration[] = []
    const parentNode = context.striptTypeExpressionsParent!.value
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

        case "FunctionExpression":
        case "FunctionDeclaration": {
            if (parentNode.id?.type === "Identifier") {
                context.blockIdentifiers.add(parentNode.id.name)
            }
            // fallthrough
        }
        case "ObjectMethod":
        case "ClassMethod":
        case "ClassPrivateMethod":
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
        walkDeclarationIdentifiers(pattern, identifier => {
            context.blockIdentifiers.add(identifier.name)
        })
    }
    for (const statement of context.value.body) {
        switch (statement.type) {
            case "VariableDeclaration": {
                if (statement.kind !== "var" || !context.inHoistTopLevel) {
                    declarations.push(statement)
                }
                break
            }
            case "TSModuleDeclaration": {
                if (!willModuleDeclarationEmitsJS(statement)) {
                    break
                }
                // fallthrough
            }
            case "TSEnumDeclaration": {
                if (context.inHoistTopLevel) {
                    break
                }
                // fallthrough
            }
            case "ClassDeclaration":
            case "FunctionDeclaration": {
                if (statement.id?.type === "Identifier") {
                    context.blockIdentifiers.add(statement.id.name)
                }
                break
            }
        }
    }
    for (const declaration of declarations) {
        for (const declarator of declaration.declarations) {
            walkDeclarationIdentifiers(declarator.id, identifier => {
                context.blockIdentifiers.add(identifier.name)
            })
        }
    }
}
