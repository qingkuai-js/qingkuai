import type { StringLiteral } from "@babel/types"
import type { ASTLocation, TemplateNode, TopLevelReferences } from "#type-declarations/compiler"

import {
    InvalidExpression,
    ExpectedExpression,
    InvalidShorthandAttributeName
} from "../message/error"
import { walk } from "../estree/walk"
import { parseExpression } from "../parser/script"
import { markNeedSourcemap } from "../estree/sundry"
import { newCleanObj } from "../../util/shared/sundry"
import { kebab2Camel } from "../../util/compiler/string"
import { jsValidIdentifierStartCharRE } from "../regular"
import { analyzeResult, inputDescriptor } from "../state"
import { getLocByIndex, getNonWhitespaceLocByIndex } from "../../util/compiler/position"
import { getAttributeBaseName, increaseCommonStringUsedTimes } from "../../util/compiler/sundry"

// 分析插值表达式：此方法会将成功解析的语法树节点缓存进 analyzeResult.template.parsedExpressions
// Analyze interpolations: this method caches successfully parsed AST nodes into `analyzeResult.template.parsedExpressions`.
export function analyzeInterpolation(
    node: TemplateNode,
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
        if (!analyzeResult.template.parsedExpressions.has(parsingInfoKey)) {
            analyzeResult.template.parsedExpressions.set(parsingInfoKey, [])
        }
        analyzeResult.template.parsedExpressions.get(parsingInfoKey)!.push({
            node: expression,
            stringLiterals,
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
            increaseCommonStringUsedTimes(node.value)
        },

        // 通过模板中对顶级作用域标识符不同的使用方式确定其响应式状态
        // Determine the reactive status of top-level scope identifiers based on their different usage patterns in the template.
        Identifier({ name, range }, context) {
            const { contextIdentifiers } = analyzeResult.template.nodeContexts.get(node)!
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
            analyzeResult.script.fullIdentifiers.add(name)
        }
    })
    return expression
}

export function analyzeShorthandAttribute(name: string, loc: ASTLocation) {
    const baseName = getAttributeBaseName(name)
    for (let i = 0; i < baseName.length; i++) {
        if ("-" === baseName[i]) {
            continue
        }
        if (jsValidIdentifierStartCharRE.test(baseName[0])) {
            break
        }
        return InvalidShorthandAttributeName(loc, name)
    }

    const info = analyzeResult.script.topLevelIdentifiers[kebab2Camel(baseName)]
    info?.status === "pending" && (info.status = inputDescriptor.options.reactivityMode)
}
