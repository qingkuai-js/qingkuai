import type { StringLiteral } from "@babel/types"
import type { ASTLocation, TemplateNode, TopLevelReferences } from "#type-declarations/compiler"

import {
    InvalidExpression,
    ExpectedExpression,
    InvalidComponentName,
    InvalidShorthandAttributeName
} from "../message/error"
import {
    getLocByIndex,
    markSourcemapEndFlag,
    getNonWhitespaceLocByIndex
} from "../../util/compiler/position"
import { walk } from "../estree/walk"
import { PositionFlag } from "../enums"
import { parseExpression } from "../parser/script"
import { markNeedSourcemap } from "../estree/sundry"
import { newCleanObj } from "../../util/shared/sundry"
import { kebab2Camel } from "../../util/compiler/string"
import { analyzeResult, inputDescriptor } from "../state"
import { getParsedExpression, getTemplateNodeContext } from "../../util/compiler/template"
import { getAttributeBaseName, increaseReusedStringUsedTimes } from "../../util/compiler/sundry"

// 分析插值表达式：此方法会将成功解析的语法树节点缓存进 analyzeResult.template.parsedExpressions
// Analyze interpolations: this method caches successfully parsed AST nodes into `analyzeResult.template.parsedExpressions`.
export function analyzeInterpolation(
    templateNode: TemplateNode,
    parsingInfoKey: any,
    source: string,
    startSourceIndex: number
) {
    if (!source.trim()) {
        return ExpectedExpression(getLocByIndex(startSourceIndex))
    }

    const expression = parseExpression(source)
    const stringLiterals: StringLiteral[] = []
    const topLevelReferences: TopLevelReferences = newCleanObj()

    if (expression) {
        analyzeResult.template.parsedExpressions.set(parsingInfoKey, {
            source,
            stringLiterals,
            reactive: false,
            node: expression,
            startSourceIndex,
            topLevelReferences
        })
    } else {
        InvalidExpression(
            getNonWhitespaceLocByIndex(startSourceIndex, startSourceIndex + source.length)
        )
    }
    walk(expression, {
        AnyNode(node) {
            markNeedSourcemap(node, startSourceIndex)
        },

        StringLiteral(node) {
            stringLiterals.push(node)
            increaseReusedStringUsedTimes(node.value)
        },

        // 通过模板中对顶级作用域标识符不同的使用方式确定其响应式状态
        // Determine the reactive status of top-level scope identifiers based on their different usage patterns in the template.
        Identifier({ name, range }, context) {
            const { contextIdentifiers } = getTemplateNodeContext(templateNode)
            const topLevelIdentifier = analyzeResult.script.topLevelIdentifiers[name]
            if (topLevelIdentifier && context.isBindingReference && !contextIdentifiers.has(name)) {
                const status = topLevelIdentifier.status
                if (
                    status === "pending" ||
                    (status === "literal" && context.isIdentifierAssignmentTarget)
                ) {
                    topLevelIdentifier.status = inputDescriptor.options.reactivityMode
                }
                ;(topLevelReferences[name] ??= []).push({
                    range,
                    declared: true,
                    shorthand: context.isShorthandIdentifierAccess
                })
            }
            if ((analyzeResult.script.fullIdentifiers.add(name), topLevelIdentifier)) {
                getParsedExpression(parsingInfoKey)!.reactive ||= true
            }
        }
    })
    return expression
}

export function analyzeTemplateAsExpression(
    node: TemplateNode,
    name: string,
    parsingKey: any,
    loc: ASTLocation,
    type: "component" | "attribue"
) {
    let expression!: ReturnType<typeof analyzeInterpolation>

    const baseName = getAttributeBaseName(name)
    const camelName = kebab2Camel(baseName)
    try {
        expression = analyzeInterpolation(
            node,
            parsingKey,
            camelName,
            loc.start.index + +(type === "attribue")
        )
    } catch {}

    if (
        type === "component" &&
        expression?.type !== "Identifier" &&
        expression?.type !== "MemberExpression"
    ) {
        return InvalidComponentName(loc, name)
    }
    if (type === "attribue" && expression?.type !== "Identifier") {
        return InvalidShorthandAttributeName(loc, name)
    }

    const nameSub = baseName.length - camelName.length
    if (nameSub > 0) {
        const parsedExpression = getParsedExpression(parsingKey)!
        const sourcemapEndFlag = PositionFlag.Sourcemap | PositionFlag.SourcemapEnd
        markSourcemapEndFlag(loc.end.index)
        parsedExpression.source = " ".repeat(nameSub) + parsedExpression.source
        inputDescriptor.positions[loc.start.index + camelName.length + 1].flag &= ~sourcemapEndFlag
    }
}
