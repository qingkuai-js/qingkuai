import type {
    Range,
    ASTLocation,
    TemplateNode,
    ContextReference,
    ParsedExpression,
    TopLevelReferences,
    TemplateNodeContext
} from "#type-declarations/compiler"

import {
    InvalidExpression,
    ExpectedExpression,
    InvalidComponentName,
    InvalidShorthandAttributeName,
    InvalidIntrinsicMethodPlacement
} from "../message/error"
import {
    getLocByIndex,
    markPositionFlag,
    getNonWhitespaceLocByIndex
} from "../../util/compiler/position"
import {
    getParsedDirective,
    getParsedExpression,
    getTemplateNodeContext
} from "../../util/compiler/template"
import { PositionFlag } from "../enums"
import { walkEstree } from "../estree/walk"
import { parseExpression } from "../parser/script"
import { markNeedSourcemap } from "../estree/sundry"
import { newCleanObj } from "../../util/shared/sundry"
import { kebab2Camel } from "../../util/compiler/string"
import { getAttributeBaseName } from "../../util/compiler/sundry"
import { analyzeResult, inputDescriptor, messages } from "../state"
import { endSemicolonRE, intrinsicMethodsRE, intrinsicVariableRE } from "../regular"

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

    let parsedExpression: ParsedExpression | undefined
    const reactiveContextReferences: ContextReference[] = []
    const nodeContext = getTemplateNodeContext(templateNode)
    const topLevelReferences: TopLevelReferences = newCleanObj()
    const expression = parseExpression(source, startSourceIndex)

    if (expression) {
        parsedExpression = {
            source,
            reactive: false,
            node: expression,
            startSourceIndex,
            topLevelReferences,
            contextReferences: reactiveContextReferences
        }
    } else {
        InvalidExpression(
            getNonWhitespaceLocByIndex(startSourceIndex, startSourceIndex + source.length),
            endSemicolonRE.test(source)
                ? "Expression with ending semicolon will be treated as statement, which is not allowed in interpolation."
                : ""
        )
    }

    walkEstree(expression, {
        AnyNode(node) {
            markNeedSourcemap(node, startSourceIndex)
        },

        // 通过模板中对顶级作用域标识符不同的使用方式确定其响应式状态
        // Determine the reactive status of top-level scope identifiers based on their different usage patterns in the template.
        Identifier({ name, range }, context) {
            const parsedDirective = nodeContext.contextIdentifiers[name]
            const topLevelIdentifier = analyzeResult.script.topLevelIdentifiers[name]
            if (!topLevelIdentifier && !parsedDirective && intrinsicMethodsRE.test(name)) {
                const sourceRange: Range = [
                    startSourceIndex + range[0],
                    startSourceIndex + range[1]
                ]
                InvalidIntrinsicMethodPlacement(getLocByIndex(...sourceRange), name)
            }
            if (context.isBindingReference && !parsedDirective) {
                if (intrinsicVariableRE.test(name)) {
                    analyzeResult.script.usedIntrinsicVars.add(name)
                }
                if (topLevelIdentifier) {
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
            }
            if (
                parsedDirective &&
                context.isBindingReference &&
                shouldContextIdentifierBeTransformed(name, parsingInfoKey, nodeContext)
            ) {
                const pattern = parsedDirective.patterns.find(parsedPattern => {
                    return parsedPattern.declaredIdentifiers.has(name)
                })!
                reactiveContextReferences.push({
                    range,
                    pattern,
                    shorthand: context.isShorthandIdentifierAccess
                })
            }
            if (
                parsedDirective ||
                analyzeResult.script.importIdentifiers.has(name) ||
                (topLevelIdentifier &&
                    topLevelIdentifier.status !== "literal" &&
                    topLevelIdentifier.status !== "pending")
            ) {
                parsedExpression!.reactive ||= true
            }
            analyzeResult.script.fullIdentifiers.add(name)
        }
    })
    if (parsedExpression) {
        analyzeResult.template.parsedExpressions.set(parsingInfoKey, parsedExpression)
    }
    return expression
}

export function analyzeTemplateAsExpression(
    node: TemplateNode,
    name: string,
    parsingKey: any,
    loc: ASTLocation,
    type: "component" | "attribute"
) {
    let expression!: ReturnType<typeof analyzeInterpolation>

    const baseName = getAttributeBaseName(name)
    const camelName = kebab2Camel(baseName)
    try {
        expression = analyzeInterpolation(
            node,
            parsingKey,
            camelName,
            loc.start.index + +(type === "attribute")
        )
    } catch {
        // 检查模式下无需再报 “无效表达式” 的错误，转而报下方的 “无效组件名称” 或 “无效属性名称” 错误
        // In check mode, there is no need to report the "Invalid Expression" error again,
        // but instead report the "Invalid Component Name" or "Invalid Shorthand Attribute Name" error below.
        if (inputDescriptor.options.checkMode) {
            messages.pop()
        }
    }

    if (
        type === "component" &&
        expression?.type !== "Identifier" &&
        expression?.type !== "MemberExpression"
    ) {
        return InvalidComponentName(loc, name)
    }
    if (type === "attribute" && expression?.type !== "Identifier") {
        return InvalidShorthandAttributeName(loc, name)
    }

    const nameSub = baseName.length - camelName.length
    if (nameSub > 0) {
        const parsedExpression = getParsedExpression(parsingKey)!
        inputDescriptor.positions[loc.start.index + camelName.length + 1].flag &=
            ~PositionFlag.SourcemapEnd
        markPositionFlag(PositionFlag.SourcemapEnd, loc.end.index)
        parsedExpression.source = " ".repeat(nameSub) + parsedExpression.source
    }
}

// #key 指令中访问 #for 指令声明的标识符不需要转换
// Identifiers declared by the `#for` directive accessed in the `#key` directive do not need to be transformed.
function shouldContextIdentifierBeTransformed(
    identifierName: string,
    parsingInfoKey: any,
    nodeContext: TemplateNodeContext
) {
    const keyDirective = nodeContext.attributesMap["#key"]
    if (!keyDirective || parsingInfoKey !== keyDirective) {
        return true
    }

    const forDirective = nodeContext.attributesMap["#for"]
    const parsedForDirective = forDirective && getParsedDirective(forDirective)
    if (!parsedForDirective) {
        return true
    }

    return !parsedForDirective.patterns.some(parsedPattern => {
        return parsedPattern.declaredIdentifiers.has(identifierName)
    })
}
