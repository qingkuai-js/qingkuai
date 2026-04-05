import type {
    Visitor,
    IntrinsicCall,
    TopLevelDeclaratorNode,
    TopLevelDeclarationNode
} from "#type-declarations/estree"
import type { EstreeWalkContext } from "#type-declarations/compiler"
import type { Identifier, VariableDeclarator, VariableDeclaration } from "@babel/types"
import type { Range, IdentifierStatus, ReactiveIntrinsics } from "#type-declarations/compiler"

import {
    isLiteral,
    isLeftValue,
    isIntrinsicCall,
    isTypeOperation,
    isFunctionLiteral
} from "../estree/assert"
import {
    indentSpacesRE,
    intrinsicMethodsRE,
    intrinsicVariableRE,
    cannotRedeclareStatusRE,
    intrinsicWatcherMethodsRE,
    intrinsicReactiveMethodsRE
} from "../regular"
import {
    CannotAliasIdentifier,
    AmbiguousReactiveMarking,
    TopLevelAwaitNotBeSupported,
    UsedForbiddenIdentifierFormat,
    IdentifierCannotBeRedeclared,
    InvalidUsageForIntrinsicMethods,
    ExportStatementsAreNotSupported,
    ShadowCompilerIntrinsicAtTopLevel,
    InvalidParameterForAliasIntrinsic,
    InvalidSpreadElementArgForIntrinsic,
    TSModuleDeclarationsAreNotSupported,
    InvalidAliasDestructuringDeclaration,
    IntrinsicNotAllowedInUsingDeclaration
} from "../message/error"
import {
    RedundantRawMark,
    UnnecessaryReactiveMark,
    RedundantArgsForIntrinsic,
    IdentifierMaybeOverwritten,
    DuplicateDefaultDeclaration,
    DeclareDerivedMixedSyntaticForms,
    UnnecessaryMutableDerivedDeclaration
} from "../message/warn"
import { PRESERVED_IDPREFIX } from "../constants"
import { stringify } from "../../util/shared/aliases"
import { getLastElem } from "../../util/shared/arrays"
import { analyzeResult, inputDescriptor } from "../state"
import { parseExpression, parseScript } from "../parser/script"
import { getScriptLocByRange } from "../../util/compiler/position"
import { walkEstree, walkPatternIdentifiers } from "../estree/walk"
import { markNeedSourcemap, stripTypeExpressions } from "../estree/sundry"

export function analyzeScript() {
    const sourceCode = inputDescriptor.script.code
    const program = parseScript(sourceCode)
    if (program) {
        walkEstree(program, visitor)
    }
    inputDescriptor.indent = indentSpacesRE.exec(sourceCode)?.[0] ?? "  "
}

const visitor: Visitor = {
    AnyNode(node, context) {
        switch (node.type) {
            case "TSExportAssignment":
            case "ExportSpecifier":
            case "ExportAllDeclaration":
            case "ExportDefaultSpecifier":
            case "ExportNamedDeclaration":
            case "ExportDefaultDeclaration":
            case "ExportNamespaceSpecifier": {
                if (context.inTopLevel) {
                    ExportStatementsAreNotSupported(getScriptLocByRange(node.range))
                }
                break
            }
            case "TSModuleDeclaration": {
                TSModuleDeclarationsAreNotSupported(getScriptLocByRange(node.range))
                break
            }
            case "CallExpression":
            case "OptionalCallExpression": {
                const call = node as IntrinsicCall
                const callee = stripTypeExpressions(call.callee)
                if (callee.type === "Identifier" && intrinsicWatcherMethodsRE.test(callee.name)) {
                    analyzeResult.script.watchers.push(call)
                }
                break
            }
        }
        if (node.type !== "Program") {
            markNeedSourcemap(node, inputDescriptor.script.loc.start.index)
        }
    },

    AwaitExpression(node, context) {
        if (context.inTopLevel) {
            TopLevelAwaitNotBeSupported(getScriptLocByRange(node.range))
        }
    },

    Identifier(node, context) {
        if (node.name.startsWith(PRESERVED_IDPREFIX)) {
            UsedForbiddenIdentifierFormat(getScriptLocByRange(node.range))
        }

        // 记录所有引用顶部标识符的位置信息
        // Record the source ranges of all references to top-level identifiers.
        if (!context.scopeIdentifiers?.has(node.name) && context.isBindingReference) {
            const { preMutatedTopLevelIdentifiers } = analyzeResult.script
            const topLevelIdentifier = analyzeResult.script.topLevelIdentifiers[node.name]
            ;(analyzeResult.script.topLevelReferences[node.name] ??= []).push({
                range: node.range,
                declared: !!topLevelIdentifier,
                shorthand: context.isShorthandIdentifierAccess
            })

            if (intrinsicVariableRE.test(node.name)) {
                analyzeResult.script.usedIntrinsicVars.add(node.name)
            }
            if (
                // prettier-ignore
                (
                    topLevelIdentifier?.status === "literal" ||
                    (!topLevelIdentifier && !preMutatedTopLevelIdentifiers.has(node.name))
                ) &&
                context.isIdentifierAssignmentTarget
            ) {
                if (topLevelIdentifier) {
                    topLevelIdentifier.status = "pending"
                } else {
                    preMutatedTopLevelIdentifiers.add(node.name)
                }
            }
            if (intrinsicMethodsRE.test(node.name)) {
                checkUsageOfIntrinsicMethods(node, context)
            }
        }
        analyzeResult.script.fullIdentifiers.add(node.name)
    },

    ClassDeclaration(node, context) {
        if (context.inTopLevel && node.id) {
            updateTopLevelIdentifiers(node.id, false, true, "literal", node, node)
        }
    },

    FunctionDeclaration(node, context) {
        if (context.inTopLevel && node.id) {
            updateTopLevelIdentifiers(node.id, true, true, "literal", node, node)
        }
    },

    TSEnumDeclaration(node, context) {
        if (context.inTopLevel) {
            updateTopLevelIdentifiers(node.id, false, true, "pending", node, node)
        }
    },

    VariableDeclaration(node, context) {
        if (node.kind === "var" ? !context.inHoistableTopLevel : !context.inTopLevel) {
            return
        }
        for (const declarator of node.declarations) {
            const destructuringIdentifierNames: string[] | undefined =
                declarator.id.type === "Identifier" ? undefined : []
            const status = inferStatusWithDeclarator(declarator, node)
            const { topLevelIdentifiers, declaratorToAliasInfos: declaratorToAlias } =
                analyzeResult.script
            const patternInfo = walkPatternIdentifiers(declarator.id, (identifier, path) => {
                const initNode = declarator.init

                // let/var 声明对衍生响应式值无意义，它不可被修改
                // `let/var` declarations are meaningless for derived reactive values, as they cannot be reassigned.
                if (status === "derived" && node.kind !== "const") {
                    UnnecessaryMutableDerivedDeclaration(getScriptLocByRange(declarator.range!))
                }

                // 衍生响应式值/别名 标识符不能重复声明（使用 var 关键字时可能导致此问题）
                // Derived reactive value or alias identifiers must not be declared more than once (this may occur when using the `var` keyword).
                if (topLevelIdentifiers[identifier.name]) {
                    const existing = topLevelIdentifiers[identifier.name]
                    const existingCannotBeRedeclared = cannotRedeclareStatusRE.test(existing.status)
                    if (existingCannotBeRedeclared || cannotRedeclareStatusRE.test(status)) {
                        if (!existingCannotBeRedeclared) {
                            IdentifierCannotBeRedeclared(
                                getScriptLocByRange(getLastElem(existing.nodeInfos)!.id.range!),
                                status
                            )
                        } else {
                            IdentifierCannotBeRedeclared(
                                getScriptLocByRange(identifier.range),
                                existing!.status
                            )
                        }
                    }
                }

                const hoist = node.kind === "var"
                const implicit = status === "pending" || status === "literal"
                updateTopLevelIdentifiers(
                    identifier,
                    hoist,
                    implicit,
                    status,
                    declarator,
                    node,
                    destructuringIdentifierNames
                )

                // status 为 alias 时记录标识符别名的访问路径
                // When the status is `alias`, record the access path of the identifier alias.
                if (
                    status === "alias" &&
                    initNode?.type === "CallExpression" &&
                    initNode.arguments.length &&
                    isLeftValue(initNode.arguments[0])
                ) {
                    let aliasInfos = declaratorToAlias.get(declarator)
                    if (!aliasInfos) {
                        declaratorToAlias.set(declarator, (aliasInfos = []))
                    }

                    const firstArg = stripTypeExpressions(initNode.arguments[0])
                    const argSource = inputDescriptor.script.code.slice(...firstArg.range!)
                    const fullPath = argSource + path
                    const expression = stripTypeExpressions(
                        parseExpression(fullPath, firstArg.start!)!
                    )
                    if (expression.type === "MemberExpression") {
                        const propertySource = fullPath.slice(...expression.property.range!)
                        aliasInfos.push({
                            id: identifier.name,
                            property: expression.computed
                                ? propertySource
                                : stringify(propertySource),
                            target: fullPath.slice(0, expression.object.end!)
                        })
                        topLevelIdentifiers[identifier.name].path = fullPath
                    }
                }

                // 记录解构声明的标识符名称列表
                // Record the list of identifier names declared by a destructuring declaration.
                topLevelIdentifiers[identifier.name].destructuringIdentifierNames =
                    destructuringIdentifierNames
                destructuringIdentifierNames?.push(identifier.name)
            })

            // 别名绑定搭配解构语法时不允许指定默认值或剩余元素语法
            // Alias bindings are not allowed to specify default values or use rest elements when combined with destructuring syntax.
            if (status === "alias") {
                const errorLoc = getScriptLocByRange(declarator.range!)
                if (!inputDescriptor.options.debug) {
                    if (node.declarations.length === 1) {
                        analyzeResult.script.eliminatedNodes.add(node)
                    } else {
                        analyzeResult.script.eliminatedNodes.add(declarator)
                    }
                }
                if (patternInfo.hasRestElement) {
                    InvalidAliasDestructuringDeclaration(errorLoc, "Rest elements")
                }
                if (patternInfo.specifiedDefaultValue) {
                    InvalidAliasDestructuringDeclaration(errorLoc, "Default values")
                }
            }
        }
    },

    TSImportEqualsDeclaration(node, context) {
        checkTopLevelIdentifier(node.id.name, node.id.range!)
        analyzeResult.script.importDeclarations.push(context)
        analyzeResult.script.importIdentifiers.add(node.id.name)
    },

    ImportDeclaration(node, context) {
        if (!node.importKind || node.importKind === "value") {
            for (const specifier of node.specifiers) {
                analyzeResult.script.importIdentifiers.add(specifier.local.name)
                checkTopLevelIdentifier(specifier.local.name, specifier.local.range!)
            }
        }
        if (!inputDescriptor.options.checkMode) {
            analyzeResult.script.eliminatedNodes.add(node)
        }
        analyzeResult.script.importDeclarations.push(context)
    }
}

// 推断顶级作用域标识符的响应式状态
// Infer the reactive status of top-level scope identifiers.
function inferStatusWithDeclarator(
    declarator: VariableDeclarator,
    declaration: VariableDeclaration
): IdentifierStatus {
    if (declaration.kind === "using" || declaration.kind === "await using") {
        return "raw"
    }

    const isShorthandDerived =
        declarator.id.type === "Identifier" &&
        declarator.id.name.startsWith("$") &&
        inputDescriptor.options.shorthandDerivedDeclaration
    const isConst = declaration.kind === "const"
    const isDestructuring = declarator.id.type !== "Identifier"
    const declaratorLoc = getScriptLocByRange(declarator.range!)
    const initNode = declarator.init && stripTypeExpressions(declarator.init)

    if (!isIntrinsicCall(initNode)) {
        const isLiteralInit = isLiteral(initNode)
        if (isShorthandDerived) {
            if (!isLiteralInit) {
                return "derived"
            }

            // 初始值为字面量值的简写衍生响应式声明无意义，退化为使用原始值
            // Shorthand derived reactive declarations with literal initial values are meaningless and are downgraded to using the raw value.
            return (UnnecessaryReactiveMark(declaratorLoc, "derived"), "raw")
        }

        // 初始值为字面量值的常量声明不具有响应式意义，退化为使用原始值
        // Constant declarations with literal initial values have no reactive semantics and are downgraded to using the raw value.
        if (!isDestructuring && (isLiteralInit || isFunctionLiteral(initNode))) {
            return isConst ? "raw" : "literal"
        }

        return "pending"
    }

    const callee = stripTypeExpressions(initNode.callee)
    if (callee.type !== "Identifier") {
        return "pending"
    }

    const calleeName = callee.name
    if (!intrinsicReactiveMethodsRE.test(calleeName)) {
        return "pending"
    }

    // 检查是否混用了简洁衍生响应式声明语法和标记响应式声明语法
    // Check whether concise derived reactive declarations and marked reactive declarations are mixed.
    if (isShorthandDerived) {
        if (calleeName === "derived" || calleeName === "derivedExp") {
            DeclareDerivedMixedSyntaticForms(declaratorLoc)
        } else {
            AmbiguousReactiveMarking(declaratorLoc, calleeName)
        }
    }

    const firstArg = initNode.arguments[0]
    const isLiteralArg = isLiteral(firstArg) || isFunctionLiteral(firstArg)
    switch (calleeName) {
        case "alias": {
            return "alias"
        }

        case "derivedExp": {
            // 通过 derivedExp 标记的衍生响应式字面量值无意义，退化为使用原始值
            // Derived reactive literal values marked with `derivedExp` are meaningless and are downgraded to using the raw value.
            if (isLiteralArg) {
                return (UnnecessaryReactiveMark(declaratorLoc, "derived"), "raw")
            }
            // fallthrough
        }
        case "derived": {
            return "derived"
        }

        default: {
            if (isShorthandDerived) {
                return "derived"
            }

            const status = calleeName as ReactiveIntrinsics
            if (isDestructuring || !isConst || !isLiteralArg) {
                return status
            }

            // 通过 raw 标记常量声明的字面量值是冗余的
            // Marking a literal value in a constant declaration with `raw` is redundant.
            if (calleeName === "raw") {
                return (RedundantRawMark(declaratorLoc), "raw")
            }

            // 通过 reactive 或 shallow 标记常量声明的字面量值是无意义的，退化为使用原始值
            // Marking a literal value in a constant declaration with `reactive` or `shallow` is meaningless and is downgraded to using the raw value.
            return (UnnecessaryReactiveMark(declaratorLoc, status), "raw")
        }
    }
}

// 更新顶级作用域标识符信息
// Update top-level scope identifier information.
function updateTopLevelIdentifiers(
    id: Identifier,
    hoist: boolean,
    implicit: boolean,
    status: IdentifierStatus,
    declarator: TopLevelDeclaratorNode,
    declaration: TopLevelDeclarationNode,
    destructuringIdentifierNames?: string[]
) {
    const existing = analyzeResult.script.topLevelIdentifiers[id.name]
    const nodeInfo = { id, declarator, declaration, destructuringIdentifierNames }
    if (status === "literal" && analyzeResult.script.preMutatedTopLevelIdentifiers.has(id.name)) {
        status = "pending"
    }
    if (existing) {
        if (status !== "pending" && status !== "literal") {
            existing.status = status
            existing.implicit = false
        }
        if (existing.status === "literal") {
            existing.status = "pending"
        }
        existing.nodeInfos.push(nodeInfo)
    } else {
        let accessor: boolean
        if (!(accessor = declaration.type !== "VariableDeclaration")) {
            switch (status) {
                case "derived": {
                    accessor = true
                    break
                }
                case "alias": {
                    accessor = !inputDescriptor.options.debug
                    break
                }
                default: {
                    accessor = declaration.kind === "let" || declaration.kind === "var"
                    break
                }
            }
        }
        analyzeResult.script.topLevelIdentifiers[id.name] = {
            status,
            hoist,
            implicit,
            accessor,
            path: "",
            transofrmedTo: "",
            nodeInfos: [nodeInfo]
        }
    }
    checkTopLevelIdentifier(id.name, id.range!)
}

// 检查顶级作用域标识符格式
// Validate top-level scope identifier formatting.
function checkTopLevelIdentifier(name: string, range: Range) {
    const sourceLoc = getScriptLocByRange(range)
    if (intrinsicMethodsRE.test(name) || intrinsicVariableRE.test(name)) {
        ShadowCompilerIntrinsicAtTopLevel(sourceLoc, name)
    }
    if (name === "$arg") {
        IdentifierMaybeOverwritten(sourceLoc, name, "inline event handler")
    }
}

// 检查编译器内置方法的使用是否合法
// Validate the usage of compiler intrinsic methods.
function checkUsageOfIntrinsicMethods(node: Identifier, context: EstreeWalkContext<Identifier>) {
    const parent = context.striptTypeOperationsParent!
    if (isIntrinsicCall(parent.value)) {
        const intrinsicCall = parent.value
        const firstArg = intrinsicCall.arguments[0]
        const argsLen = intrinsicCall.arguments.length
        const intrinsicCallLoc = getScriptLocByRange(intrinsicCall.range!)
        switch (node.name) {
            case "watchExp":
            case "preWatchExp":
            case "postWatchExp":
            case "syncWatchExp": {
                if (argsLen > 2) {
                    RedundantArgsForIntrinsic(intrinsicCallLoc, node.name, 2, argsLen)
                }
                return
            }
            case "defaultRefs":
            case "defaultProps": {
                if (!parent.inTopLevel) {
                    break
                }
                if (!inputDescriptor.options.checkMode) {
                    analyzeResult.script.eliminatedNodes.add(parent.value)
                }
                if (firstArg?.type === "SpreadElement") {
                    InvalidSpreadElementArgForIntrinsic(
                        getScriptLocByRange(firstArg.range!),
                        node.name
                    )
                }
                if (argsLen > 1) {
                    RedundantArgsForIntrinsic(intrinsicCallLoc, node.name, 1, argsLen)
                }

                let isValidDefinition = true
                parent.walkAncestors(({ value }) => {
                    if (
                        !isTypeOperation(value) &&
                        value.type !== "Program" &&
                        value.type !== "ExpressionStatement"
                    ) {
                        return !(isValidDefinition = false)
                    }
                })
                if (isValidDefinition) {
                    const key = node.name === "defaultProps" ? "props" : "refs"
                    const existing = analyzeResult.script.defaultItems[key]
                    if (existing) {
                        DuplicateDefaultDeclaration(
                            getScriptLocByRange(existing.intrinsicId.range!),
                            node.name.slice(7).toLowerCase()
                        )
                    }
                    if (
                        parent.value.arguments.length &&
                        parent.value.arguments[0].type !== "ArgumentPlaceholder"
                    ) {
                        analyzeResult.script.defaultItems[key] = {
                            intrinsicId: node,
                            value: parent.value.arguments[0]
                        }
                    } else {
                        analyzeResult.script.defaultItems[key] = undefined
                    }
                    return
                }
                break
            }

            default: {
                if (firstArg?.type === "SpreadElement") {
                    InvalidSpreadElementArgForIntrinsic(
                        getScriptLocByRange(firstArg.range!),
                        node.name
                    )
                }
                if (argsLen > 1) {
                    RedundantArgsForIntrinsic(intrinsicCallLoc, node.name, 1, argsLen)
                }
                if (node.name === "alias") {
                    if (
                        parent.value.arguments.length !== 1 ||
                        !isLeftValue(parent.value.arguments[0])
                    ) {
                        InvalidParameterForAliasIntrinsic(getScriptLocByRange(parent.value.range!))
                    }
                }

                const grandParent = parent.striptTypeOperationsParent!
                if (parent.inTopLevel && grandParent.value.type === "VariableDeclarator") {
                    const declaration = grandParent.parent!.value as VariableDeclaration
                    if (
                        node.name === "alias" &&
                        grandParent.value.id.type === "Identifier" &&
                        parent.value.arguments[0]?.type === "Identifier"
                    ) {
                        CannotAliasIdentifier(getScriptLocByRange(parent.value.range!))
                    }
                    if (declaration.kind === "using" || declaration.kind === "await using") {
                        IntrinsicNotAllowedInUsingDeclaration(
                            getScriptLocByRange(grandParent.value.range!),
                            node.name
                        )
                    } else {
                        analyzeResult.script.declaratorToIntrinsic.set(grandParent.value, context)
                    }
                    return
                }
            }
        }
    }
    InvalidUsageForIntrinsicMethods(getScriptLocByRange(node.range!), node.name)
}
