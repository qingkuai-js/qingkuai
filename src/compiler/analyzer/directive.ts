import type { ContextPattern } from "#type-declarations/estree"
import type { TemplateAttribute, TemplateNode } from "#type-declarations/compiler"

import {
    InvalidSlotName,
    ConflictDirectives,
    UnrecognizedDirective,
    EmptyContextPattern,
    TooManyBindingPatterns,
    MissingDirectiveValue,
    MissingPrecedingDirective,
    InvalidSlotDirectivePlacement,
    InvalidTargetDirectivePlacement,
    InvalidContextPatternForDirective,
    HtmlDirectiveRequiresSingleTextChild
} from "../message/error"
import {
    getLocByIndex,
    getNonWhiteSpaceLocByLoc,
    getNonWhitespaceLocByIndex
} from "../../util/compiler/position"
import { analyzeResult } from "../state"
import { parsePattern } from "../parser/script"
import { analyzeInterpolation } from "./interpolation"
import { parseDirectiveValue } from "../parser/directive"
import { RedundantDirectiveValue } from "../message/warn"
import { getPrevNonTextNode } from "../../util/compiler/template"
import { walkPatternIdentifiers } from "../../util/compiler/estree/walk"
import { isAttributeValid, isNonEmptyExpression } from "../../util/compiler/assert"
import { CONFLICT_DIRECTIVES_MAP, DIRECTIVE_LIST, REQUIRED_VALUE_DIRECTIVES } from "../constants"

export function analyzeDirective(node: TemplateNode, directive: TemplateAttribute) {
    let conflictingDirective: TemplateAttribute | undefined

    const directiveName = directive.name.raw
    const directiveValue = directive.value.raw
    const nodeInfo = analyzeResult.template.nodeInfos.get(node)!
    const valueStartSourceIndex = directive.value.loc.start.index

    const localAnalyzeInterpolation = (source: string, startSourceIndex: number) => {
        return analyzeInterpolation(node, directive, source, startSourceIndex)
    }

    // 缺少指令值
    // Missing directive value.
    if (REQUIRED_VALUE_DIRECTIVES.has(directiveName) && !directive.equalSign) {
        MissingDirectiveValue(directive.loc, directiveName)
    }

    // 未知指令
    // Unrecognized directives.
    if (!DIRECTIVE_LIST.has(directiveName)) {
        if (isAttributeValid(directive) && isNonEmptyExpression(directiveValue)) {
            localAnalyzeInterpolation(directiveValue, valueStartSourceIndex)
        }
        return UnrecognizedDirective(directive.loc, directiveName)
    }

    // 检查是否存在冲突的指令
    // Check for conflicting directives.
    if (CONFLICT_DIRECTIVES_MAP[directiveName]) {
        conflictingDirective = nodeInfo.directives.find(item => {
            return CONFLICT_DIRECTIVES_MAP[directiveName].includes(item.name.raw)
        })
    }
    if (conflictingDirective) {
        const conflictingName = conflictingDirective.name.raw
        ConflictDirectives(directive.name.loc, conflictingName, directiveName)
        ConflictDirectives(conflictingDirective.name.loc, conflictingName, directiveName)
    }

    switch (directiveName) {
        case "#slot": {
            if (!node.parent || !node.parent.componentTag) {
                InvalidSlotDirectivePlacement(directive.loc)
            } else {
                const parseResult = parseDirectiveValue(
                    directiveValue,
                    "from",
                    valueStartSourceIndex
                )
                if (parseResult.patterns.length) {
                    recordContextIdentifiers(parseResult.patterns[0])
                }
                if (parseResult.patterns.length > 1) {
                    const errorLoc = getNonWhitespaceLocByIndex(
                        valueStartSourceIndex,
                        valueStartSourceIndex + parseResult.keywordIndex
                    )
                    TooManyBindingPatterns(errorLoc, directiveName, 1)
                }

                // from 关键字后方的插槽名称必须是静态字符串字面量
                // The slot name following the `from` keyword must be a static string literal.
                const name = localAnalyzeInterpolation(
                    parseResult.base,
                    parseResult.baseStartSourceIndex
                )
                if (
                    name?.type !== "StringLiteral" &&
                    (name?.type !== "TemplateLiteral" || name.expressions.length)
                ) {
                    InvalidSlotName(
                        getNonWhitespaceLocByIndex(
                            parseResult.baseStartSourceIndex,
                            parseResult.baseStartSourceIndex + parseResult.base.length
                        )
                    )
                }
            }
            return
        }

        case "#for": {
            const parseResult = parseDirectiveValue(directiveValue, "of", valueStartSourceIndex)
            for (const pattern of parseResult.patterns) {
                recordContextIdentifiers(pattern)
            }
            if (parseResult.patterns.length > 2) {
                const errorLoc = getNonWhitespaceLocByIndex(
                    valueStartSourceIndex,
                    valueStartSourceIndex + parseResult.keywordIndex
                )
                TooManyBindingPatterns(errorLoc, directiveName, 2)
            }
            localAnalyzeInterpolation(parseResult.base, parseResult.baseStartSourceIndex)
            return
        }

        case "#then":
        case "#catch": {
            const expectedList = ["#await", directiveName === "#then" ? "#catch" : "#then"]
            if (
                !expectedList.includes(getFirstDirectiveNameOfPrevNonTextNode(node)) &&
                !nodeInfo.directives.some(item => expectedList.includes(item.name.raw))
            ) {
                MissingPrecedingDirective(directive.name.loc, directiveName, expectedList, true)
            }
            checkWhetherDirectiveValueIsValidPattern()
            return
        }

        case "#target": {
            if (node.parent && node.parent.componentTag) {
                InvalidTargetDirectivePlacement(directive.loc)
            }
            break
        }

        case "#html": {
            if (node.children.length !== 1 && "" !== node.children[0].tag) {
                HtmlDirectiveRequiresSingleTextChild(
                    getLocByIndex(node.startTagEndPos.index, node.endTagStartPos.index)
                )
            }
            break
        }

        case "#else":
        case "#elif": {
            if (directiveName === "#else" && directive.valueEnclosure !== "none") {
                RedundantDirectiveValue(directive.loc, directiveName)
            }
            const expectedList = ["#if", "#elif"]
            if (!expectedList.includes(getFirstDirectiveNameOfPrevNonTextNode(node))) {
                MissingPrecedingDirective(directive.name.loc, directiveName, expectedList, false)
            }
            break
        }
    }

    if (isAttributeValid(directive) && isNonEmptyExpression(directiveValue)) {
        localAnalyzeInterpolation(directiveValue, valueStartSourceIndex)
    }

    // 检查指令值是否是有效的绑定模式：#then, #catch, #slot 指令值必须是绑定模式
    // Check whether the directive value is a valid binding pattern:
    // the values of `#then`, `#catch`, and `#slot` directives must be binding patterns.
    function checkWhetherDirectiveValueIsValidPattern() {
        const pattern = parsePattern(directiveValue)
        if (pattern) {
            recordContextIdentifiers(pattern)
        } else {
            InvalidContextPatternForDirective(
                getNonWhiteSpaceLocByLoc(directive.value.loc),
                directiveName
            )
        }
    }

    // 将指令产生的上下边标识符记录到节点
    // Record the upper and lower edge identifiers generated by the directive on the node.
    function recordContextIdentifiers(pattern: ContextPattern) {
        let validIdentifierCount = 0
        walkPatternIdentifiers(pattern, ({ name }) => {
            validIdentifierCount++
            nodeInfo.contextIdentifiers.add(name)
        })
        if (!validIdentifierCount) {
            EmptyContextPattern(
                getNonWhitespaceLocByIndex(
                    valueStartSourceIndex + pattern.start!,
                    valueStartSourceIndex + pattern.end!
                )
            )
        } else {
            if (!analyzeResult.template.parsedPatterns.has(directive)) {
                analyzeResult.template.parsedPatterns.set(directive, [])
            }
            analyzeResult.template.parsedPatterns.get(directive)!.push(pattern)
        }
    }
}

// 获取指定节点的前一个非文本节点的兄弟节点
// Get the previous non-text sibling node of the specified node.
function getPrevNonTextNodeInfo(node: TemplateNode) {
    const prevNonTextNode = getPrevNonTextNode(node)
    if (!prevNonTextNode) {
        return null
    }
    return analyzeResult.template.nodeInfos.get(prevNonTextNode)!
}

function getFirstDirectiveNameOfPrevNonTextNode(node: TemplateNode) {
    return getPrevNonTextNodeInfo(node)?.directives[0].name.raw ?? ""
}
