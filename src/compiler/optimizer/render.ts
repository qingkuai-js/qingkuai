import ts from "typescript"

import { getStriptTypeOperationsNode } from "../ts-ast/sundry"
import { TemplateNodeContext } from "#type-declarations/compiler"
import { getParsedExpression } from "../../util/compiler/template"
import { isExpressionEqual, isMemberAccessExpression } from "../ts-ast/assert"

// 优化：当文本内容仅包含一个插值表达式，且该表达式与同一节点上的 #key 指令的表达式相等时，不为该文本内容生成 render effect
// Optimization: When the text content contains only one interpolated expression, and that expression is equal
// to the expression of the #key directive on the same node, do not generate a render effect for that text content
export function equalsWithKeyDirectiveValue(
    nodeContext: TemplateNodeContext,
    parsedExpressionKey: any
) {
    const parsedExpression = getParsedExpression(parsedExpressionKey)
    if (!parsedExpression?.node) {
        return false
    }

    let contextIdentifier: string | undefined
    const expNode = getStriptTypeOperationsNode(parsedExpression.node)
    if (ts.isIdentifier(expNode)) {
        contextIdentifier = expNode.text
    } else if (isMemberAccessExpression(expNode) && ts.isIdentifier(expNode.expression)) {
        contextIdentifier = expNode.expression.text
    }

    const parsedDirective = nodeContext.contextIdentifiers[contextIdentifier!]
    if (parsedDirective?.src.directive.name.raw !== "#for") {
        return false
    }

    const keyDirective = parsedDirective.src.nodeContext.attributesMap["#key"]
    const parsedExpOfKeyDirective = keyDirective && getParsedExpression(keyDirective)
    if (!parsedExpOfKeyDirective?.node) {
        return false
    }
    return isExpressionEqual(parsedExpression.node, parsedExpOfKeyDirective.node)
}
