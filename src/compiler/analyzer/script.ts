import type { WalkContext } from "../../util/compiler/estree/walk"
import type { Identifier, VariableDeclarator } from "@babel/types"
import type { Range, IdentifierStatus } from "#type-declarations/compiler"
import type { TopLevelDeclarationNode, Visitor } from "#type-declarations/estree"

import {
    indentSpacesRE,
    intrinsicMethodsRE,
    intrinsicVariableRE,
    forbiddenIdentifierRE,
    intrinsicWatcherMethodsRE,
    intrinsicReactiveMethodsRE
} from "../regular"
import {
    AmbiguousReactiveMarking,
    TopLevelAwaitNotBeSupported,
    ExportRelatedNotBeSupported,
    UsedForbiddenIdentifierFormat,
    RedeclareDerivedReactiveValue,
    InvalidUsageForIntrinsicMethods,
    ShadowCompilerIntrinsicAtTopLevel,
    InvalidParameterForAliasIntrinsic,
    InvalidAliasDestructuring
} from "../message/error"
import {
    UnnecessaryReactiveMark,
    IdentifierMaybeOverwritten,
    DeclareDerivedMixedSyntaticForms,
    UnnecessaryMutableDerivedDeclaration
} from "../message/warn"
import {
    isLiteral,
    isLeftValue,
    willModuleDeclarationEmitsJS
} from "../../util/compiler/estree/assert"
import { parseScript } from "../parser/script"
import { getLastElem } from "../../util/shared/arrays"
import { analyzeResult, inputDescriptor } from "../state"
import { getScriptLocByRange } from "../../util/compiler/position"
import { stripTypeExpressions } from "../../util/compiler/estree/sundry"
import { walk, walkPatternIdentifiers } from "../../util/compiler/estree/walk"

export function analyzeScript() {
    const sourceCode = inputDescriptor.script.code
    const program = parseScript(sourceCode)
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
            ;(analyzeResult.script.locations[node.loc.start.line - 1] ??= new Set()).add(
                node.loc.start.column
            )
            ;(analyzeResult.script.locations[node.loc.end.line - 1] ??= new Set()).add(
                node.loc.end.column
            )
        }
    },

    Identifier(node, context) {
        if (forbiddenIdentifierRE.test(node.name)) {
            UsedForbiddenIdentifierFormat(getScriptLocByRange(node.range), node.name)
        }

        // 记录所有引用顶部标识符的位置信息
        // Record the source ranges of all references to top-level identifiers.
        if (!context.scopeIdentifiers.has(node.name) && context.isBindingReference) {
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
            updateTopLevelIdentifiers(node.id, false, false, true, "pending", context)
        }
    },

    FunctionDeclaration(node, context) {
        if (context.inTopLevel && node.id) {
            updateTopLevelIdentifiers(node.id, true, false, true, "pending", context)
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
                    const topLevelIdentifier = analyzeResult.script.topLevelIdentifiers.get(
                        identifier.name
                    )

                    // status 为 alias 时记录标识符别名的访问路径
                    // When the status is `alias`, record the access path of the identifier alias.
                    if (status === "alias" && topLevelIdentifier) {
                        topLevelIdentifier.path = path
                    }
                    if (status === "alias" && topLevelIdentifier) {
                    }

                    // 衍生响应式值不能重复声明（使用 var 关键字时可能导致此问题）
                    // Derived reactive values must not be declared more than once (this may occur when using the `var` keyword).
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
                    updateTopLevelIdentifiers(identifier, hoist, isConst, implicit, status, context)
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
            path: "",
            range: id.range!,
            accessor: !isConst,
            contexts: [context]
        })
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

// 推断顶级作用域标识符的响应式状态
// Infer the reactive status of top-level scope identifiers.
function inferStatusWithDeclarator(declarator: VariableDeclarator, isConst: boolean) {
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
    if (callee.type !== "Identifier") {
        return "pending"
    }

    const status = callee.name as IdentifierStatus
    if (!intrinsicReactiveMethodsRE.test(callee.name)) {
        return "pending"
    }

    // 检查是否混用了简洁衍生响应式声明语法和标记响应式声明语法
    // Check whether concise derived reactive declarations and marked reactive declarations are mixed.
    if (isShorthandDerived) {
        if (status === "derived") {
            DeclareDerivedMixedSyntaticForms(sourceLoc)
        } else {
            AmbiguousReactiveMarking(sourceLoc, status)
        }
    }

    // 通过标记字面量值声明的 衍生响应式值/常量 无响应式意义，退化为使用原始值
    // Derived reactive values or constants declared from literal values have no reactive semantics and are downgraded to using their raw values.
    if (
        status !== "alias" &&
        isLiteral(initNode.arguments[0]) &&
        (status === "derived" || (isConst && status !== "raw"))
    ) {
        return UnnecessaryReactiveMark(sourceLoc, status === "reactive" ? "" : status), "raw"
    }
    return status
}

// 检查编译器内置方法的使用是否合法
// Validate the usage of compiler intrinsic methods.
function checkUsageOfIntrinsicMethods(node: Identifier, context: WalkContext<Identifier>) {
    if (
        !context.isBindingReference ||
        !intrinsicMethodsRE.test(node.name) ||
        context.scopeIdentifiers.has(node.name)
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
                if (context.striptTypeOperationsParent?.value.type === "Program") {
                    if (
                        parent.value.arguments.length &&
                        parent.value.arguments[0].type !== "ArgumentPlaceholder"
                    ) {
                        // @ts-ignore: node.name is defaultProps or defaultRefs
                        analyzeResult.script[node.name] = parent.value.arguments[0]
                    }
                    return
                }
                // fallthrough
            }
            default: {
                if (node.name === "alias") {
                    const argument = parent.value.arguments[0]
                    if (!argument || !isLeftValue(argument)) {
                        const range: Range = !argument
                            ? parent.value.range!
                            : [argument.start!, getLastElem(parent.value.arguments)!.end!]!
                        InvalidParameterForAliasIntrinsic(getScriptLocByRange(range))
                    }
                }
                if (
                    context.inTopLevel &&
                    parent.striptTypeOperationsParent!.value.type === "VariableDeclarator"
                ) {
                    return
                }
            }
        }
    }
    InvalidUsageForIntrinsicMethods(getScriptLocByRange(node.range!), node.name)
}
