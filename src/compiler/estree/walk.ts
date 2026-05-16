import type { LVal, Identifier, PatternLike, VariableDeclaration } from "@babel/types"
import type { EstreeWalkContext as EstreeWalkContextImpl } from "#type-declarations/compiler"
import type { AnyNode, Visitor, WalkPatternCallback, WithLoc } from "#type-declarations/estree"

import { any } from "../../util/shared/sundry"
import { isArray, isObject } from "../../util/shared/assert"
import { intrinsicMethodsRE, intrinsicVariableRE } from "../regular"
import { isBlock, isTypeOperation, willModuleDeclarationEmitsJS } from "./assert"

export class EstreeWalkContext<T extends AnyNode = AnyNode> implements EstreeWalkContextImpl {
    inTopLevel = false
    isBindingReference = false

    constructor(
        public value: T,
        public parent: EstreeWalkContext | null = null,
        public scopeIdentifiers: Set<string> | undefined = undefined
    ) {
        if (value) {
            if (value.type !== "Program" && this.isScopeBoundary) {
                recordScopeIdentifiers(this)
            }
            this.isBindingReference = isBindingReference(this)
            this.inTopLevel = !parent || (parent.inTopLevel && !isBlock(parent.value))
        }
    }

    // 判断节点是否为作用域边界的上下文
    // Determine whether the node is within a scope boundary context.
    get isScopeBoundary() {
        const node = this.value
        const parentNode = this.parent?.value
        switch (node.type) {
            case "Program":
            case "TSModuleBlock":
            case "BlockStatement": {
                return true
            }
        }
        switch (parentNode?.type) {
            case "ForInStatement":
            case "ForOfStatement":
            case "ArrowFunctionExpression": {
                return node === parentNode.body
            }
            case "ForStatement": {
                return (
                    node === parentNode.body ||
                    node === parentNode.test ||
                    node === parentNode.update
                )
            }
        }
        return false
    }

    // 判断节点是否为标识符形式的赋值目标
    // Determine whether the node is an identifier-form assignment target.
    get isIdentifierAssignmentTarget() {
        if (!this.isBindingReference) {
            return false
        }

        let ret = false
        this.walkAncestors(current => {
            switch (current.value.type) {
                case "MemberExpression":
                case "TSNonNullExpression":
                case "OptionalMemberExpression": {
                    return true
                }
                case "UpdateExpression":
                case "AssignmentExpression": {
                    return (ret = true)
                }
            }
        })
        return ret
    }

    // 判断节点是否为不可提升作用域边界的上下文
    // Determine whether the node is within a non-hoistable scope boundary context.
    get isNonHoistableScopeBoundary() {
        const node = this.value
        const parentNode = this.parent?.value
        switch (node.type) {
            case "Program":
            case "TSModuleBlock": {
                return true
            }
            case "BlockStatement": {
                switch (parentNode?.type) {
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
        return parentNode?.type === "ArrowFunctionExpression" && node === parentNode.body
    }

    // 获取节点所属的作用域
    // Get the scope that the node belongs to.
    get scope(): EstreeWalkContext | null {
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
    get nonHoistableScope(): EstreeWalkContext | null {
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
                return ((ret = current.value.type === "Program"), true)
            }
        })
        return ret
    }

    // 节点是否为简写标识符访问，如 { a } 等
    // Whether the node is a shorthand identifier aceess, e.g. `{ a }`.
    get isShorthandIdentifierAccess() {
        if (this.value.type !== "Identifier") {
            return false
        }
        return !!any(this.parent)?.value.shorthand
    }

    // 节点是否为计算标识符，如 { [a]: 1 } 等
    // Whether the node is a computed identifier, e.g. `{ [a]: 1 }`.
    get isComputedIdentifier() {
        if (this.value.type !== "Identifier") {
            return false
        }
        return !!any(this.parent)?.value.computed
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

    get striptTypeOperationsParent(): EstreeWalkContext<AnyNode> | null {
        if (!this.parent) {
            return null
        }
        if (!isTypeOperation(this.parent.value)) {
            return this.parent
        }
        return this.parent.striptTypeOperationsParent
    }

    findAncestorUntil<T extends AnyNode["type"]>(
        type: T
    ): EstreeWalkContext<AnyNode & { type: T }> | null {
        let ret: any = null
        this.walkAncestors(current => {
            if (type === current.value.type) {
                return ((ret = current), true)
            }
        })
        return ret
    }

    walkAncestors(callback: (context: EstreeWalkContext) => any) {
        for (let current = this.parent; current; current = current.parent) {
            if (callback(current)) {
                break
            }
        }
    }
}

export function walkEstree(node: any, visitor: Visitor, context = new EstreeWalkContext(node)) {
    if (!node) {
        return
    }

    const recursive = (child: any) => {
        if (child && child.loc) {
            walkEstree(
                child,
                visitor,
                new EstreeWalkContext(
                    child,
                    context,
                    context.scopeIdentifiers && new Set(context.scopeIdentifiers)
                )
            )
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
            for (const item of child) {
                recursive(item)
            }
        } else if (isObject(child)) {
            recursive(child)
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
export function walkPatternIdentifiers(pattern: LVal | PatternLike, callback: WalkPatternCallback) {
    const result = {
        hasRestElement: false,
        specifiedDefaultValue: false
    }

    function extract(from: LVal | PatternLike, path: string): void | boolean {
        switch (from.type) {
            case "ArrayPattern": {
                for (let i = 0; i < from.elements.length; i++) {
                    const element = from.elements[i]
                    if (!element) {
                        continue
                    }
                    if (element.type === "RestElement") {
                        extract(from.elements[i]!, path)
                    } else {
                        extract(from.elements[i]!, path + `[${i}]`)
                    }
                }
                break
            }
            case "ObjectPattern": {
                for (const property of from.properties) {
                    if (property.type === "RestElement") {
                        extract(property, path)
                    } else {
                        let extra = ""
                        if (property.key.type === "Identifier") {
                            extra = `.${property.key.name}`
                        }
                        extract(property.value as PatternLike, path + extra)
                    }
                }
                break
            }
            case "Identifier": {
                return callback(from as WithLoc<Identifier>, path)
            }
            case "RestElement": {
                return ((result.hasRestElement = true), extract(from.argument, path))
            }
            case "AssignmentPattern": {
                return ((result.specifiedDefaultValue = true), extract(from.left, path))
            }
        }
    }

    return (extract(pattern, ""), result)
}

// 判断是否为值标识符引用
// Determine whether this is a value identifier reference.
function isBindingReference(context: EstreeWalkContext) {
    const node = context.value
    const parent = context.parent
    const parentNode = parent?.value
    const assertedContext = context as EstreeWalkContext<Identifier>
    if (node.type !== "Identifier") {
        return false
    }
    if (!parentNode) {
        return true
    }
    switch (parentNode.type) {
        case "BreakStatement":
        case "LabeledStatement":
        case "ContinueStatement":
        case "PrivateName":
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

        case "ArrowFunctionExpression": {
            return !assertedContext.isParameterIdentifier
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
            let isAssignmentTargetPattern = false
            let patternContext: EstreeWalkContext<PatternLike> | undefined
            if (parentNode.type !== "ObjectProperty" && parentNode.type !== "RestElement") {
                patternContext = parent as any
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
                            return ((patternContext = current as any), true)
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
                        return (isAssignmentTargetPattern = true)
                    }
                }
            })
            if (isAssignmentTargetPattern) {
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
function recordScopeIdentifiers(context: EstreeWalkContext) {
    const node = context.value
    const paramPatterns: PatternLike[] = []
    const declarations: VariableDeclaration[] = []
    const children = isBlock(node) ? node.body : [node]
    const parentNode = context.striptTypeOperationsParent!.value

    const extendScopeIdentifiers = (context: EstreeWalkContext, { name }: Identifier) => {
        if (
            process.env.VITEST === "true" ||
            intrinsicMethodsRE.test(name) ||
            intrinsicVariableRE.test(name)
        ) {
            ;(context.scopeIdentifiers ??= new Set()).add(name)
        }
    }

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
                extendScopeIdentifiers(context, parentNode.id)
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
            extendScopeIdentifiers(context, identifier)
        })
    }
    for (const child of children) {
        switch (child.type) {
            case "VariableDeclaration": {
                declarations.push(child)
                break
            }
            case "TSModuleDeclaration": {
                if (!willModuleDeclarationEmitsJS(child)) {
                    break
                }
                // fallthrough
            }
            case "ClassDeclaration":
            case "TSEnumDeclaration":
            case "FunctionDeclaration": {
                if (child.id?.type === "Identifier") {
                    extendScopeIdentifiers(context, child.id)
                }
                break
            }
        }
    }
    for (const declaration of declarations) {
        for (const declarator of declaration.declarations) {
            walkPatternIdentifiers(declarator.id, identifier => {
                let scope: EstreeWalkContext | null = context
                if (declaration.kind === "var" && !context.isNonHoistableScopeBoundary) {
                    scope = context.nonHoistableScope
                }
                if (scope && !scope.inTopLevel) {
                    extendScopeIdentifiers(scope, identifier)
                }
            })
        }
    }
}
