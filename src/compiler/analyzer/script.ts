import type { WalkContext } from "../../util/compiler/estree/walk"
import type { Identifier, VariableDeclarator } from "@babel/types"
import type { TopLevelDeclarationNode, Visitor } from "#type-declarations/estree"
import type { Range, TopLevelIdentifierStatus } from "#type-declarations/compiler"

import {
    indentSpacesRE,
    intrinsicMethodsRE,
    intrinsicVariableRE,
    forbiddenIdentifierRE
} from "../regular"
import {
    AmbiguousReactiveMarking,
    TopLevelAwaitNotBeSupported,
    ExportRelatedNotBeSupported,
    UsedForbiddenIdentifierFormat,
    RedeclareDerivedReactiveValue,
    InvalidUsageForIntrinsicMethods,
    ShadowCompilerIntrinsicAtTopLevel
} from "../message/error"
import {
    UnnecessaryReactiveMark,
    IdentifierMaybeOverwritten,
    DeclareDerivedMixedSyntaticForms,
    UnnecessaryMutableDerivedDeclaration
} from "../message/warn"
import { parseScript } from "../parser/script"
import { analyzeResult, inputDescriptor } from "../state"
import { getScriptLocByRange } from "../../util/compiler/position"
import { stripTypeExpressions } from "../../util/compiler/estree/sundry"
import { walk, walkDeclarationIdentifiers } from "../../util/compiler/estree/walk"
import { isLiteral, willModuleDeclarationEmitsJS } from "../../util/compiler/estree/assert"

export function analyzeScript() {
    const sourceCode = inputDescriptor.script.code
    const program = parseScript(sourceCode, inputDescriptor.script.loc.start.index)

    program && walk(program, visitor)
    inputDescriptor.indent = indentSpacesRE.exec(sourceCode)?.length || 2
}

const visitor: Visitor = {
    AwaitExpression(node, context) {
        if (context.inTopLevel) {
            TopLevelAwaitNotBeSupported(getScriptLocByRange(node.range))
        }
    },

    AnyNode(node, context) {
        switch (node.type) {
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
    },

    Identifier(node, context) {
        context.isBindingReference
        if (forbiddenIdentifierRE.test(node.name)) {
            UsedForbiddenIdentifierFormat(getScriptLocByRange(node.range), node.name)
        }

        // 记录所有引用顶部标识符的位置信息
        if (!context.blockIdentifiers.has(node.name) && context.isBindingReference) {
            const { topLevelReferences, topLevelIdentifiers: topLevelDeclarations } =
                analyzeResult.script
            if (!topLevelReferences.has(node.name)) {
                topLevelReferences.set(node.name, [])
            }
            topLevelReferences.get(node.name)!.push({
                range: node.range,
                shorthand: context.isShorthandIdentifier,
                declared: topLevelDeclarations.has(node.name)
            })
        }
        checkUsageOfIntrinsicMethods(node, context)
        analyzeResult.script.fullIdentifiers.add(node.name)
    },

    ClassDeclaration(node, context) {
        if (context.inTopLevel && node.id) {
            updateTopLevelIdentifiers(node.id, false, true, "pending", context)
        }
    },

    FunctionDeclaration(node, context) {
        if (context.inTopLevel && node.id) {
            updateTopLevelIdentifiers(node.id, true, true, "pending", context)
        }
    },

    TSEnumDeclaration(node, context) {
        if (context.inHoistTopLevel) {
            updateTopLevelIdentifiers(node.id, true, true, "pending", context)
        }
    },

    TSModuleDeclaration(node, context) {
        if (
            node.id.type === "StringLiteral" ||
            context.parent?.value.type === "TSModuleDeclaration"
        ) {
            return
        }
        if (context.inHoistTopLevel && willModuleDeclarationEmitsJS(node)) {
            updateTopLevelIdentifiers(node.id, true, true, "pending", context)
        }
    },

    VariableDeclaration(node, context) {
        if (node.kind === "var" ? !context.inHoistTopLevel : !context.inTopLevel) {
            return
        }
        for (const declarator of node.declarations) {
            walkDeclarationIdentifiers(declarator.id, identifier => {
                const status = inferTopDeclarationStatus(
                    declarator,
                    node.kind === "const",
                    declarator.id.type !== "Identifier"
                )
                const topLevelIdentifier = analyzeResult.script.topLevelIdentifiers.get(
                    identifier.name
                )!

                // 衍生响应式值不能重复声明（使用 var 关键字时可能导致此问题）
                if (
                    topLevelIdentifier &&
                    (topLevelIdentifier.status === "derived" || status === "derived")
                ) {
                    let range: Range
                    if (topLevelIdentifier.status === "derived") {
                        range = identifier.range
                    } else {
                        range = topLevelIdentifier.range
                    }
                    RedeclareDerivedReactiveValue(getScriptLocByRange(range), identifier.name)
                } else if (status === "derived" && node.kind !== "const") {
                    UnnecessaryMutableDerivedDeclaration(getScriptLocByRange(identifier.range!))
                }

                const [hoist, implicit] = [node.kind === "var", status === "pending"]
                updateTopLevelIdentifiers(identifier, hoist, implicit, status, context)
            })
        }
    },

    ImportDeclaration(node, context) {
        for (const specifier of node.specifiers) {
            analyzeResult.script.fullIdentifiers.add(specifier.local.name)
            checkTopLevelIdentifier(specifier.local.name, specifier.local.range!)
        }
        analyzeResult.script.importDeclarations.push(context)
    }
}

// 推断顶级作用域标识符的响应式状态
function inferTopDeclarationStatus(
    declarator: VariableDeclarator,
    isConst: boolean,
    isDestructuring: boolean
): TopLevelIdentifierStatus {
    const isShorthandDerived =
        declarator.id.type === "Identifier" &&
        declarator.id.name.startsWith("$") &&
        inputDescriptor.options.shorthandDerivedDeclaration
    const sourceLoc = getScriptLocByRange(declarator.range!)
    const initNode = declarator.init && stripTypeExpressions(declarator.init)

    if (initNode?.type !== "CallExpression") {
        if (isLiteral(initNode) && (isConst || isShorthandDerived)) {
            if (!isShorthandDerived) {
                return "raw"
            }
            UnnecessaryReactiveMark(sourceLoc, "derived")
        }
        return isShorthandDerived ? "derived" : "pending"
    }

    const callee = stripTypeExpressions(initNode.callee)
    if (
        callee.type !== "Identifier" ||
        callee.name.startsWith("default") ||
        !intrinsicMethodsRE.test(callee.name)
    ) {
        return "pending"
    }

    const status = callee.name as TopLevelIdentifierStatus

    // 检查是否混用了简洁衍生响应式声明语法和标记响应式声明语法
    if (isShorthandDerived) {
        if (status === "derived") {
            DeclareDerivedMixedSyntaticForms(sourceLoc)
        } else {
            AmbiguousReactiveMarking(sourceLoc, status)
        }
    }

    // 通过标记字面量值声明的 衍生响应式值/常量 无响应式意义，使用原始值
    if (
        isLiteral(initNode.arguments[0]) &&
        (status === "derived" || (isConst && status !== "raw"))
    ) {
        return UnnecessaryReactiveMark(sourceLoc, status === "reactive" ? "" : status), "raw"
    }
    return status
}

// 更新顶级作用域标识符信息
function updateTopLevelIdentifiers(
    id: Identifier,
    hoist: boolean,
    implicit: boolean,
    status: TopLevelIdentifierStatus,
    context: WalkContext<TopLevelDeclarationNode>
) {
    const existing = analyzeResult.script.topLevelIdentifiers.get(id.name)
    if (existing) {
        if (status !== "pending") {
            existing.status = status
            existing.implicit = false
        }
        existing.contexts.push(context)
    } else {
        analyzeResult.script.topLevelIdentifiers.set(id.name, {
            status,
            hoist,
            implicit,
            range: id.range!,
            contexts: [context]
        })
    }
    checkTopLevelIdentifier(id.name, id.range!)
}

// 检查顶级作用域标识符格式
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
function checkUsageOfIntrinsicMethods(node: Identifier, context: WalkContext<Identifier>) {
    if (
        !context.isBindingReference ||
        !intrinsicMethodsRE.test(node.name) ||
        context.blockIdentifiers.has(node.name)
    ) {
        return
    }

    const parent = context.striptTypeExpressionsParent!
    const isReactiveRelated = !node.name.startsWith("default")
    if (parent.value.type === "CallExpression") {
        if (!isReactiveRelated) {
            if (
                parent.value.arguments.length &&
                parent.value.arguments[0].type !== "ArgumentPlaceholder"
            ) {
                // @ts-ignore: node.name is defaultProps or defaultRefs
                analyzeResult.script[node.name] = parent.value.arguments[0]
            }
            if (context.striptTypeExpressionsParent?.value.type === "Program") {
                return
            }
        }
        if (
            isReactiveRelated &&
            context.inTopLevel &&
            parent.striptTypeExpressionsParent!.value.type === "VariableDeclarator"
        ) {
            return
        }
    }
    InvalidUsageForIntrinsicMethods(getScriptLocByRange(node.range!), node.name)
}
