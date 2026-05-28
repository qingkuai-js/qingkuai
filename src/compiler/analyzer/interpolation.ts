import type {
    Range,
    ASTLocation,
    TemplateNode,
    ContextReference,
    ParsedExpression,
    TopLevelReferences,
    TemplateNodeContext
} from "#type-declarations/compiler"

import ts from "typescript"

import {
    InvalidExpression,
    ExpectedExpression,
    InvalidComponentTag,
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
import { parseExpression } from "../parser/script"
import { markNeedSourcemap } from "../ts-ast/sundry"
import { newCleanObj } from "../../util/shared/sundry"
import { walkTsNodeWithContext } from "../ts-ast/walk"
import { kebab2Camel } from "../../util/compiler/string"
import { isIdentifierAssignmentTarget } from "../ts-ast/assert"
import { getAttributeBaseName } from "../../util/compiler/sundry"
import { analyzeResult, inputDescriptor, messages } from "../state"
import { collectReusedStringReference } from "../optimizer/compress"
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

    const attrRawName = parsingInfoKey?.name?.raw
    const reactiveContextReferences: ContextReference[] = []
    const nodeContext = getTemplateNodeContext(templateNode)
    const topLevelReferences: TopLevelReferences = newCleanObj()
    const expression = parseExpression(source, startSourceIndex)
    const isReferenceAttr = attrRawName?.startsWith("&") && nodeContext.attributesMap[attrRawName]

    if (expression) {
        parsedExpression = {
            source,
            reactive: false,
            node: expression,
            startSourceIndex,
            topLevelReferences,
            reusedStringReferences: [],
            contextReferences: reactiveContextReferences
        }
    } else {
        InvalidExpression(
            getNonWhitespaceLocByIndex(startSourceIndex, startSourceIndex + source.length),
            endSemicolonRE.test(source)
                ? "Expression with ending semicolon will be treated as statement, which is not allowed in interpolation."
                : ""
        )
        return null
    }

    walkTsNodeWithContext(expression, node => {
        markNeedSourcemap(node, startSourceIndex)
        collectReusedStringReference(node, parsedExpression.reusedStringReferences)

        // 通过模板中对顶级作用域标识符不同的使用方式确定其响应式状态
        // Determine the reactive status of top-level scope identifiers based on their different usage patterns in the template.
        if (ts.isIdentifier(node)) {
            const idName = node.text
            const nodeRange: Range = [node.getStart(), node.getEnd()]
            const parsedDirective = nodeContext.contextIdentifiers[idName]
            const sourceRange = nodeRange.map(n => n + startSourceIndex) as Range
            const topLevelIdentifier = analyzeResult.script.topLevelIdentifiers[idName]
            if (!topLevelIdentifier && !parsedDirective && intrinsicMethodsRE.test(idName)) {
                InvalidIntrinsicMethodPlacement(getLocByIndex(...sourceRange), idName)
            }
            if (node.isBindingReference && !parsedDirective) {
                if (intrinsicVariableRE.test(idName)) {
                    analyzeResult.script.usedIntrinsicVars.add(idName)
                }
                if (topLevelIdentifier) {
                    const status = topLevelIdentifier.status
                    if (
                        // prettier-ignore
                        status === "pending" ||
                        (
                            status === "literal" &&
                            (isReferenceAttr || isIdentifierAssignmentTarget(node))
                        )
                    ) {
                        for (const exp of topLevelIdentifier.usedExpressions) {
                            exp.reactive = true
                        }
                        topLevelIdentifier.status = inputDescriptor.options.reactivityMode
                    }
                    ;(topLevelReferences[idName] ??= []).push({
                        declared: true,
                        range: nodeRange,
                        shorthand: ts.isShorthandPropertyAssignment(node.parent)
                    })
                    topLevelIdentifier.usedExpressions.add(parsedExpression!)
                }
            }
            if (
                parsedDirective &&
                node.isBindingReference &&
                shouldContextIdentifierBeTransformed(idName, parsingInfoKey, nodeContext)
            ) {
                const pattern = parsedDirective.patterns.find(parsedPattern => {
                    return parsedPattern.declaredIdentifiers.has(idName)
                })!
                reactiveContextReferences.push({
                    pattern,
                    range: nodeRange,
                    shorthand: ts.isShorthandPropertyAssignment(node)
                })
            }
            if (
                parsedDirective ||
                analyzeResult.script.importIdentifiers.has(idName) ||
                (topLevelIdentifier &&
                    topLevelIdentifier.status !== "literal" &&
                    topLevelIdentifier.status !== "pending")
            ) {
                parsedExpression!.reactive ||= true
            }
            if (idName === "props" || idName === "refs") {
                parsedExpression!.reactive ||= true
            }
            analyzeResult.script.fullIdentifiers.add(idName)
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
    const baseName = getAttributeBaseName(name)
    const source = type === "attribute" ? kebab2Camel(baseName) : baseName
    const expression = analyzeInterpolation(
        node,
        parsingKey,
        source,
        loc.start.index + +(type === "attribute")
    )

    // 检查模式下无需再报 “无效表达式” 的错误，转而报下方的 “无效组件名称” 或 “无效属性名称” 错误
    // In check mode, there is no need to report the "Invalid Expression" error again,
    // but instead report the "Invalid Component Name" or "Invalid Shorthand Attribute Name" error below.
    if (!expression && inputDescriptor.options.checkMode) {
        messages.pop()
    }

    if (type === "attribute") {
        if (!expression || !ts.isIdentifier(expression)) {
            return InvalidShorthandAttributeName(loc, name)
        }
    } else if (
        !expression ||
        (!ts.isIdentifier(expression) && !ts.isPropertyAccessExpression(expression))
    ) {
        return InvalidComponentTag(loc, name)
    }

    const nameSub = baseName.length - source.length
    if (nameSub > 0) {
        const parsedExpression = getParsedExpression(parsingKey)!
        inputDescriptor.positions[loc.start.index + source.length + 1].flag &=
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
