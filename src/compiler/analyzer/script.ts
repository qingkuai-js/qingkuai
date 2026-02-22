import type {
    Visitor,
    IntrinsicCall,
    TopLevelDeclaratorNode,
    TopLevelDeclarationNode
} from "#type-declarations/estree"
import type {
    Identifier,
    MemberExpression,
    VariableDeclarator,
    VariableDeclaration
} from "@babel/types"
import type { WalkContext } from "../estree/walk"
import type { Range, IdentifierStatus, ReactiveIntrinsics } from "#type-declarations/compiler"

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
    InvalidAliasDestructuringDeclaration,
    TopLevelAwaitNotBeSupported,
    UsedForbiddenIdentifierFormat,
    IdentifierCannotBeRedeclared,
    InvalidUsageForIntrinsicMethods,
    ExportStatementsAreNotSupported,
    ShadowCompilerIntrinsicAtTopLevel,
    InvalidParameterForAliasIntrinsic,
    TSModuleDeclarationsAreNotSupported,
    IntrinsicNotAllowedInUsingDeclaration
} from "../message/error"
import {
    RedundantRawMark,
    UnnecessaryReactiveMark,
    IdentifierMaybeOverwritten,
    DuplicateDefaultDeclaration,
    DeclareDerivedMixedSyntaticForms,
    UnnecessaryMutableDerivedDeclaration
} from "../message/warn"
import { stringify } from "../../util/shared/aliases"
import { getLastElem } from "../../util/shared/arrays"
import { analyzeResult, inputDescriptor } from "../state"
import { walk, walkPatternIdentifiers } from "../estree/walk"
import { parseExpression, parseScript } from "../parser/script"
import { getScriptLocByRange } from "../../util/compiler/position"
import { increaseCommonStringCount } from "../../util/compiler/sundry"
import { markNeedSourcemap, stripTypeExpressions } from "../estree/sundry"
import { isLiteral, isLeftValue, isTypeOperation, isFunctionLiteral } from "../estree/assert"

export function analyzeScript() {
    const sourceCode = inputDescriptor.script.code
    const program = parseScript(sourceCode)
    program && walk(program, visitor)
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
            }
            case "TSModuleDeclaration": {
                TSModuleDeclarationsAreNotSupported(getScriptLocByRange(node.range))
            }
            case "CallExpression":
            case "OptionalCallExpression": {
                const call = node as IntrinsicCall
                const callee = stripTypeExpressions(call.callee)
                if (callee.type === "Identifier" && intrinsicWatcherMethodsRE.test(callee.name)) {
                    analyzeResult.script.watchers.push(call)
                }
            }
        }
        if (node.type !== "Program") {
            markNeedSourcemap(node, inputDescriptor.script.loc.start.index)
        }
    },

    StringLiteral(node, context) {
        if (context.parent?.value.type !== "ImportDeclaration") {
            increaseCommonStringCount(node.value)
            analyzeResult.script.stringLiterals.push(node)
        }
    },

    AwaitExpression(node, context) {
        if (context.inTopLevel) {
            TopLevelAwaitNotBeSupported(getScriptLocByRange(node.range))
        }
    },

    Identifier(node, context) {
        if (node.name.startsWith("__r__")) {
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
            const specifiedDefaultValue = walkPatternIdentifiers(
                declarator.id,
                (identifier, path) => {
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
                        const existingCannotBeRedeclared = cannotRedeclareStatusRE.test(
                            existing.status
                        )
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
                        const argSource = inputDescriptor.script.code.slice(
                            ...stripTypeExpressions(initNode.arguments[0]).range!
                        )
                        const fullPath = argSource + path
                        const expression = stripTypeExpressions(
                            parseExpression(fullPath)!
                        ) as MemberExpression
                        const propertySource = fullPath.slice(...expression.property.range!)
                        aliasInfos.push({
                            property: expression.computed
                                ? propertySource
                                : stringify(propertySource),
                            target: fullPath.slice(0, expression.object.end!)
                        })
                        topLevelIdentifiers[identifier.name].path = fullPath
                    }

                    // 记录解构声明的标识符名称列表
                    // Record the list of identifier names declared by a destructuring declaration.
                    topLevelIdentifiers[identifier.name].destructuringIdentifierNames =
                        destructuringIdentifierNames
                    destructuringIdentifierNames?.push(identifier.name)
                }
            )

            // 别名绑定搭配解构语法时不允许指定默认值
            // Alias bindings are not allowed to specify default values when used with destructuring syntax.
            if (status === "alias" && specifiedDefaultValue) {
                InvalidAliasDestructuringDeclaration(getScriptLocByRange(declarator.range!))
            }
        }
    },

    TSImportEqualsDeclaration(node, context) {
        checkTopLevelIdentifier(node.id.name, node.id.range!)
        analyzeResult.script.importDeclarations.push(context)
    },

    ImportDeclaration(node, context) {
        if (!node.importKind || node.importKind === "value") {
            for (const specifier of node.specifiers) {
                checkTopLevelIdentifier(specifier.local.name, specifier.local.range!)
            }
        }
        if (!inputDescriptor.options.checkMode) {
            analyzeResult.script.eliminateNodes.add(node)
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

    if (initNode?.type !== "CallExpression" && initNode?.type !== "OptionalCallExpression") {
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

    const calleeName = callee.name as ReactiveIntrinsics
    if (!intrinsicReactiveMethodsRE.test(calleeName)) {
        return "pending"
    }

    // 检查是否混用了简洁衍生响应式声明语法和标记响应式声明语法
    // Check whether concise derived reactive declarations and marked reactive declarations are mixed.
    if (isShorthandDerived) {
        if (calleeName === "derived") {
            DeclareDerivedMixedSyntaticForms(declaratorLoc)
        } else {
            AmbiguousReactiveMarking(declaratorLoc, calleeName)
        }
    }

    const firstArg = initNode.arguments[0]
    const isLiteralArg = isLiteral(firstArg)
    const initLoc = getScriptLocByRange(initNode.range!)
    const isFunctionLiteralArg = isFunctionLiteral(firstArg)
    switch (calleeName) {
        case "alias": {
            return "alias"
        }
        case "derived": {
            if (!isLiteralArg) {
                return "derived"
            }

            // 通过 derived 标记的衍生响应式字面量值无意义，退化为使用原始值
            // Derived reactive literal values marked with `derived` are meaningless and are downgraded to using the raw value.
            return (UnnecessaryReactiveMark(initLoc, calleeName), "raw")
        }
        default: {
            if (isShorthandDerived) {
                return "derived"
            }

            if (isDestructuring || !isConst || !(isLiteralArg || isFunctionLiteralArg)) {
                return calleeName
            }

            // 通过 raw 标记常量声明的字面量值是冗余的
            // Marking a literal value in a constant declaration with `raw` is redundant.
            if (calleeName === "raw") {
                return (RedundantRawMark(initLoc), "raw")
            }

            // 通过 reactive 或 shallow 标记常量声明的字面量值是无意义的，退化为使用原始值
            // Marking a literal value in a constant declaration with `reactive` or `shallow` is meaningless and is downgraded to using the raw value.
            return (UnnecessaryReactiveMark(initLoc, calleeName), "raw")
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
        const accessor = declaration.type !== "VariableDeclaration" || declaration.kind !== "const"
        analyzeResult.script.topLevelIdentifiers[id.name] = {
            status,
            hoist,
            implicit,
            accessor,
            path: "",
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
function checkUsageOfIntrinsicMethods(node: Identifier, context: WalkContext<Identifier>) {
    const parent = context.striptTypeOperationsParent!
    if (parent.value.type === "CallExpression" || parent.value.type === "OptionalCallExpression") {
        switch (node.name) {
            case "watch":
            case "preWatch":
            case "postWatch":
            case "syncWatch": {
                return
            }
            case "defaultRefs":
            case "defaultProps": {
                if (!parent.inTopLevel) {
                    break
                }
                if (!inputDescriptor.options.checkMode) {
                    analyzeResult.script.eliminateNodes.add(parent.value)
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
                    const existing = analyzeResult.script[node.name]
                    if (existing) {
                        DuplicateDefaultDeclaration(
                            getScriptLocByRange(existing.id.range!),
                            node.name.slice(7).toLowerCase()
                        )
                    }
                    if (
                        parent.value.arguments.length &&
                        parent.value.arguments[0].type !== "ArgumentPlaceholder"
                    ) {
                        analyzeResult.script[node.name] = {
                            id: node,
                            value: parent.value.arguments[0]
                        }
                    } else {
                        analyzeResult.script[node.name] = undefined
                    }
                    return
                }
                break
            }
            default: {
                if (node.name === "alias") {
                    const args = parent.value.arguments
                    const callRange = parent.value.range!
                    if (args[0]?.type === "Identifier") {
                        CannotAliasIdentifier(getScriptLocByRange(callRange))
                    }
                    if (args.length !== 1 || !isLeftValue(args[0])) {
                        InvalidParameterForAliasIntrinsic(getScriptLocByRange(callRange))
                    }
                }

                const grandParent = parent.striptTypeOperationsParent!
                if (parent.inTopLevel && grandParent.value.type === "VariableDeclarator") {
                    const declaration = grandParent.parent!.value as VariableDeclaration
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
