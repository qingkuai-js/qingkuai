import type { Visitor } from "#type-declarations/estree"
import type { WalkContext } from "../../util/compiler/estree/walk"
import type { Identifier, VariableDeclarator } from "@babel/types"
import type { Range, TopDeclarationStatus } from "#type-declarations/compiler"

import {
    indentSpacesRE,
    bannedIdentifierRE,
    intrinsicMethodsRE,
    intrinsicVariableRE
} from "../regular"
import {
    RegisterExistingIdentifier,
    UsedBannedIdentifierFormat,
    TopLevelAwaitNotBeSupported,
    ExportRelatedNotBeSupported,
    InvalidUsageForIntrinsicMethods
} from "../message/error"
import { parseScript } from "../parser/script"
import { analyzeResult, inputDescriptor } from "../state"
import { IdentifierMaybeOverwritten } from "../message/warn"
import { getScriptLocByRange } from "../../util/compiler/position"
import { stripTypeExpressions } from "../../util/compiler/estree/sundry"
import { willModuleDeclarationEmitsJS } from "../../util/compiler/estree/assert"
import { walk, walkDeclarationIdentifiers } from "../../util/compiler/estree/walk"

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

    AnyNode(node) {
        switch (node.type) {
            case "ExportSpecifier":
            case "ExportAllDeclaration":
            case "ExportDefaultSpecifier":
            case "ExportNamedDeclaration":
            case "ExportDefaultDeclaration":
            case "ExportNamespaceSpecifier": {
                ExportRelatedNotBeSupported(getScriptLocByRange(node.range))
            }
        }
    },

    Identifier(node, context) {
        context.isBindingReference
        if (bannedIdentifierRE.test(node.name)) {
            UsedBannedIdentifierFormat(getScriptLocByRange(node.range), node.name)
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
            analyzeResult.script.topLevelIdentifiers.set(node.id.name, {
                context,
                hoist: false,
                implicit: true,
                status: "pending"
            })
            checkTopLevelIdentifier(node.id.name, node.id.range!)
        }
    },

    FunctionDeclaration(node, context) {
        if (context.inTopLevel && node.id) {
            analyzeResult.script.topLevelIdentifiers.set(node.id.name, {
                context,
                hoist: true,
                implicit: true,
                status: "pending"
            })
            checkTopLevelIdentifier(node.id.name, node.id.range!)
        }
    },

    TSEnumDeclaration(node, context) {
        if (context.inHoistTopLevel) {
            analyzeResult.script.topLevelIdentifiers.set(node.id.name, {
                context,
                hoist: true,
                implicit: true,
                status: "pending"
            })
            analyzeResult.script.topLevelEnums.push(context)
            checkTopLevelIdentifier(node.id.name, node.id.range!)
        }
    },

    TSModuleDeclaration(node, context) {
        if (
            context.inHoistTopLevel &&
            node.id.type !== "StringLiteral" &&
            willModuleDeclarationEmitsJS(node)
        ) {
            analyzeResult.script.topLevelIdentifiers.set(node.id.name, {
                context,
                hoist: true,
                implicit: true,
                status: "pending"
            })
            analyzeResult.script.topLevelNamespaces.push(context)
            checkTopLevelIdentifier(node.id.name, node.id.range!)
        }
    },

    VariableDeclaration(node, context) {
        if (node.kind === "var" ? context.inHoistTopLevel : !context.inTopLevel) {
            return
        }
        for (const declarator of node.declarations) {
            walkDeclarationIdentifiers(declarator.id, ({ name, range }) => {
                const status = detectTopDeclarationStatus(declarator)
                analyzeResult.script.topLevelIdentifiers.set(name, {
                    status,
                    context,
                    hoist: node.kind === "var",
                    implicit: status === "pending"
                })
                checkTopLevelIdentifier(name, range)
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

function checkTopLevelIdentifier(name: string, range: Range) {
    const sourceLoc = getScriptLocByRange(range)
    if (intrinsicMethodsRE.test(name) || intrinsicVariableRE.test(name)) {
        RegisterExistingIdentifier(sourceLoc, name)
    }
    if (name === "$arg") {
        IdentifierMaybeOverwritten(sourceLoc, name, "inline event handler")
    }
}

function detectTopDeclarationStatus(declarator: VariableDeclarator): TopDeclarationStatus {
    if (!declarator.init) {
        return "pending"
    }

    const init = stripTypeExpressions(declarator.init)
    if (init.type !== "CallExpression") {
        return "pending"
    }

    const callee = stripTypeExpressions(init.callee)
    if (
        callee.type !== "Identifier" ||
        callee.name.startsWith("default") ||
        !intrinsicMethodsRE.test(callee.name)
    ) {
        return "pending"
    }

    return callee.name as TopDeclarationStatus
}

function checkUsageOfIntrinsicMethods(node: Identifier, context: WalkContext<Identifier>) {
    const sourceLoc = getScriptLocByRange(node.range!)
    if (!intrinsicMethodsRE.test(node.name)) {
        return
    }

    const parent = context.striptTypeExpressionsParent!
    const isReactiveRelated = !node.name.startsWith("default")
    if (context.inTopLevel && parent.value.type === "CallExpression") {
        if (!isReactiveRelated) {
            if (
                parent.value.arguments.length &&
                parent.value.arguments[0].type !== "ArgumentPlaceholder"
            ) {
                // @ts-ignore: node.name is defaultProps or defaultRefs
                analyzeResult.script[node.name] = parent.value.arguments[0]
            }
            return
        }
        if (parent.striptTypeExpressionsParent!.value.type === "VariableDeclarator") {
            return
        }
    }
    InvalidUsageForIntrinsicMethods(
        sourceLoc,
        node.name,
        isReactiveRelated ? " to mark variable initializer" : ""
    )
}
