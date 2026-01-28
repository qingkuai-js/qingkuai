import type { TemplateNode } from "#type-declarations/compiler"

import { parseExpression } from "../parser/script"
import { InvalidExpression } from "../message/error"
import { walk } from "../../util/compiler/estree/walk"
import { analyzeResult, inputDescriptor } from "../state"
import { getNonWhitespaceLocByIndex } from "../../util/compiler/position"

export function analyzeInterpolation(
    node: TemplateNode,
    pasingInfoKey: any,
    source: string,
    startSourceIndex: number,
    valueOfInterpolation = true
) {
    const expression = parseExpression(source)
    if (expression) {
        walk(expression, {
            // 通过模板中对顶级作用域标识符不同的使用方式确定其响应式状态
            // Determine the reactive status of top-level scope identifiers based on their different usage patterns in the template.
            Identifier({ name }, context) {
                const { contextIdentifiers } = analyzeResult.template.nodeInfos.get(node)!
                const topLevelIdentifier = analyzeResult.script.topLevelIdentifiers[name]
                if (
                    topLevelIdentifier &&
                    context.isBindingReference &&
                    !contextIdentifiers.has(name)
                ) {
                    const status = topLevelIdentifier.status
                    if (
                        status === "pending" ||
                        (status === "literal" && context.isIdentifierAssignmentTarget)
                    ) {
                        topLevelIdentifier.status = inputDescriptor.options.reactivityMode
                    }
                }
            }
        })
    } else {
        InvalidExpression(
            getNonWhitespaceLocByIndex(startSourceIndex, startSourceIndex + source.length),
            valueOfInterpolation
        )
    }
    if (inputDescriptor.options.checkMode) {
        analyzeResult.template.parsedExpressions.set(pasingInfoKey, expression)
    }
}
