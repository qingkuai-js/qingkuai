import type { WalkContext } from "../../util/compiler/estree/walk"
import type { Identifier, VariableDeclarator } from "@babel/types"
import type { TopLevelDeclarationNode, Visitor } from "#type-declarations/estree"
import type { Range, IdentifierStatus, ReactiveIntrinsics } from "#type-declarations/compiler"

import {
    indentSpacesRE,
    intrinsicMethodsRE,
    intrinsicVariableRE,
    intrinsicWatcherMethodsRE,
    intrinsicReactiveMethodsRE
} from "../regular"
import {
    AmbiguousReactiveMarking,
    InvalidAliasDestructuring,
    TopLevelAwaitNotBeSupported,
    ExportRelatedNotBeSupported,
    UsedForbiddenIdentifierFormat,
    RedeclareDerivedReactiveValue,
    InvalidUsageForIntrinsicMethods,
    ShadowCompilerIntrinsicAtTopLevel,
    InvalidParameterForAliasIntrinsic
} from "../message/error"
import {
    RedundantRawMark,
    UnnecessaryReactiveMark,
    IdentifierMaybeOverwritten,
    DuplicateDefaultDeclaration,
    DeclareDerivedMixedSyntaticForms,
    UnnecessaryMutableDerivedDeclaration
} from "../message/warn"
import {
    isLiteral,
    isLeftValue,
    isTypeOperation,
    isFunctionLiteral,
    willModuleDeclarationEmitsJS
} from "../../util/compiler/estree/assert"
import { parseScript } from "../parser/script"
import { getLastElem } from "../../util/shared/arrays"
import { analyzeResult, inputDescriptor } from "../state"
import { getScriptLocByRange } from "../../util/compiler/position"
import { increaseCommonStringCount } from "../../util/compiler/sundry"
import { walk, walkPatternIdentifiers } from "../../util/compiler/estree/walk"
import { markNeedSourcemap, stripTypeExpressions } from "../../util/compiler/estree/sundry"

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
                    ExportRelatedNotBeSupported(getScriptLocByRange(node.range))
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
            const topLevelIdentifier = analyzeResult.script.topLevelIdentifiers[node.name]
            ;(analyzeResult.script.topLevelReferences[node.name] ??= []).push({
                range: node.range,
                declared: !!topLevelIdentifier,
                shorthand: context.isShorthandIdentifierAccess
            })
            if (topLevelIdentifier?.status === "literal" && context.isIdentifierAssignmentTarget) {
                topLevelIdentifier.status = "pending"
            }
        }
        checkUsageOfIntrinsicMethods(node, context)
        analyzeResult.script.fullIdentifiers.add(node.name)
    },

    ClassDeclaration(node, context) {
        if (context.inTopLevel && node.id) {
            updateTopLevelIdentifiers(node.id, false, false, true, "literal", context)
        }
    },

    FunctionDeclaration(node, context) {
        if (context.inTopLevel && node.id) {
            updateTopLevelIdentifiers(node.id, true, false, true, "literal", context)
        }
    },

    TSEnumDeclaration(node, context) {
        if (context.inTopLevel) {
            updateTopLevelIdentifiers(node.id, true, false, true, "pending", context)
        }
    },

    TSModuleDeclaration(node, context) {
        if (
            node.id.type === "StringLiteral" ||
            context.parent?.value.type === "TSModuleDeclaration"
        ) {
            return
        }
        if (context.inTopLevel && willModuleDeclarationEmitsJS(node)) {
            updateTopLevelIdentifiers(node.id, true, false, true, "pending", context)
        }
    },

    VariableDeclaration(node, context) {
        if (node.kind === "var" ? !context.inHoistableTopLevel : !context.inTopLevel) {
            return
        }
        for (const declarator of node.declarations) {
            const isConst = node.kind === "const"
            const status = inferStatusWithDeclarator(declarator, isConst)
            const specifiedDefaultValue = walkPatternIdentifiers(
                declarator.id,
                (identifier, path) => {
                    const initNode = declarator.init
                    const { topLevelIdentifiers } = analyzeResult.script
                    const existing = topLevelIdentifiers[identifier.name]

                    // 衍生响应式值不能重复声明（使用 var 关键字时可能导致此问题）
                    // Derived reactive values must not be declared more than once (this may occur when using the `var` keyword).
                    if (existing && (existing.status === "derived" || status === "derived")) {
                        let range: Range
                        if (existing.status === "derived") {
                            range = identifier.range
                        } else {
                            range = existing.range
                        }
                        RedeclareDerivedReactiveValue(getScriptLocByRange(range), identifier.name)
                    } else if (status === "derived" && node.kind !== "const") {
                        UnnecessaryMutableDerivedDeclaration(getScriptLocByRange(identifier.range!))
                    }

                    const hoist = node.kind === "var"
                    const implicit = status === "pending" || status === "literal"
                    updateTopLevelIdentifiers(identifier, hoist, isConst, implicit, status, context)

                    // status 为 alias 时记录标识符别名的访问路径
                    // When the status is `alias`, record the access path of the identifier alias.
                    if (status === "alias" && initNode?.type === "CallExpression") {
                        const base = inputDescriptor.script.code.slice(
                            ...initNode.arguments[0].range!
                        )
                        topLevelIdentifiers[identifier.name].path = base + path
                    }
                }
            )

            // 别名绑定搭配解构语法时不允许指定默认值
            // Alias bindings are not allowed to specify default values when used with destructuring syntax.
            if (status === "alias" && specifiedDefaultValue) {
                InvalidAliasDestructuring(getScriptLocByRange(declarator.range!))
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
        analyzeResult.script.importDeclarations.push(context)
    },

    CallExpression(node, context) {
        if (node.callee.type === "Identifier" && intrinsicWatcherMethodsRE.test(node.callee.name)) {
            analyzeResult.script.watchers.push(context)
        }
    }
}

// 推断顶级作用域标识符的响应式状态
// Infer the reactive status of top-level scope identifiers.
function inferStatusWithDeclarator(
    declarator: VariableDeclarator,
    isConst: boolean
): IdentifierStatus {
    const isShorthandDerived =
        declarator.id.type === "Identifier" &&
        declarator.id.name.startsWith("$") &&
        inputDescriptor.options.shorthandDerivedDeclaration
    const declaratorLoc = getScriptLocByRange(declarator.range!)
    const initNode = declarator.init && stripTypeExpressions(declarator.init)

    if (initNode?.type !== "CallExpression") {
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
        if (isLiteralInit || isFunctionLiteral(initNode)) {
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

            if (!isConst || !(isLiteralArg || isFunctionLiteralArg)) {
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
    isConst: boolean,
    implicit: boolean,
    status: IdentifierStatus,
    context: WalkContext<TopLevelDeclarationNode>
) {
    const existing = analyzeResult.script.topLevelIdentifiers[id.name]
    if (existing) {
        if (status !== "pending" && status !== "literal") {
            existing.status = status
            existing.implicit = false
        }
        if (existing.status === "literal") {
            existing.status = "pending"
        }
        existing.contexts.push(context)
    } else {
        analyzeResult.script.topLevelIdentifiers[id.name] = {
            status,
            hoist,
            implicit,
            path: "",
            range: id.range!,
            accessor: !isConst,
            contexts: [context]
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
    if (
        !context.isBindingReference ||
        !intrinsicMethodsRE.test(node.name) ||
        context.scopeIdentifiers?.has(node.name)
    ) {
        return
    }

    const parent = context.striptTypeOperationsParent!
    if (parent.value.type === "CallExpression") {
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
                    if (
                        parent.value.arguments.length &&
                        parent.value.arguments[0].type !== "ArgumentPlaceholder"
                    ) {
                        const existing = analyzeResult.script[node.name]
                        if (existing) {
                            DuplicateDefaultDeclaration(
                                getScriptLocByRange(existing.id.range!),
                                node.name.slice(7).toLowerCase()
                            )
                        }
                        analyzeResult.script[node.name] = {
                            id: node,
                            value: parent.value.arguments[0]
                        }
                    }
                    return
                }
                break
            }
            default: {
                if (node.name === "alias") {
                    const args = parent.value.arguments
                    if (args.length !== 1 || !isLeftValue(args[0])) {
                        const range: Range = !args[0]
                            ? parent.value.range!
                            : [args[0].start!, getLastElem(args)!.end!]!
                        InvalidParameterForAliasIntrinsic(getScriptLocByRange(range))
                    }
                }
                if (
                    parent.inTopLevel &&
                    parent.striptTypeOperationsParent!.value.type === "VariableDeclarator"
                ) {
                    return
                }
            }
        }
    }
    InvalidUsageForIntrinsicMethods(getScriptLocByRange(node.range!), node.name)
}
