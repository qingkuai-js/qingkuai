import type { ContextPattern } from "#type-declarations/estree"
import type { TemplateAttribute, TemplateNode } from "#type-declarations/compiler"

import {
    InvalidSlotName,
    EmptyContextPattern,
    ConflictingDirectives,
    ExpectedStringLiteral,
    UnrecognizedDirective,
    TooManyBindingPatterns,
    MissingDirectiveValue,
    MissingPrecedingDirective,
    InvalidKeyDirectivePlacement,
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
import { parseContextPattern } from "../parser/script"
import { analyzeInterpolation } from "./interpolation"
import { parseDirectiveValue } from "../parser/directive"
import { analyzeResult, inputDescriptor } from "../state"
import { getPrevNonTextNode } from "../../util/compiler/template"
import { markNeedSourcemap } from "../../util/compiler/estree/sundry"
import { walk, walkPatternIdentifiers } from "../../util/compiler/estree/walk"
import { RedundantDirectiveValue, UnnecessaryHtmlDirective } from "../message/warn"
import { isNonEmptyExpression, shouldAnalyzeAttributeValue } from "../../util/compiler/assert"
import { CONFLICTING_DIRECTIVES_MAP, DIRECTIVE_LIST, REQUIRED_VALUE_DIRECTIVES } from "../constants"

export function analyzeDirective(node: TemplateNode, directive: TemplateAttribute) {
    let conflictingDirective: TemplateAttribute | undefined

    const nameLoc = directive.name.loc
    const rawName = directive.name.raw
    const rawValue = directive.value.raw
    const nodeInfo = analyzeResult.template.nodeInfos.get(node)!
    const valueStartSourceIndex = directive.value.loc.start.index

    const localAnalyzeInterpolation = (source: string, startSourceIndex: number) => {
        return analyzeInterpolation(node, directive, source, startSourceIndex)
    }

    // 缺少指令值
    // Missing directive value.
    if (REQUIRED_VALUE_DIRECTIVES.has(rawName) && !directive.equalSign) {
        MissingDirectiveValue(directive.loc, rawName)
    }

    // 未知指令
    // Unrecognized directives.
    if (!DIRECTIVE_LIST.has(rawName)) {
        UnrecognizedDirective(nameLoc, rawName)
    }

    // 检查是否存在冲突的指令
    // Check for conflicting directives.
    if (CONFLICTING_DIRECTIVES_MAP[rawName]) {
        conflictingDirective = nodeInfo.sortedDirectives.find(item => {
            return CONFLICTING_DIRECTIVES_MAP[rawName].includes(item.name.raw)
        })
    }
    if (conflictingDirective) {
        ConflictingDirectives(nameLoc, rawName, conflictingDirective.name.raw)
        ConflictingDirectives(conflictingDirective.name.loc, rawName, conflictingDirective.name.raw)
    }

    switch (rawName) {
        case "#slot": {
            if (!node.parent || !node.parent.componentTag) {
                return InvalidSlotDirectivePlacement(nameLoc)
            }
            if (directive.valueEnclosure !== "none") {
                const { patterns, keywordIndex, base, baseStartSourceIndex } = parseDirectiveValue(
                    rawValue,
                    "from",
                    valueStartSourceIndex
                )
                if (patterns.length) {
                    recordContextIdentifiers(patterns[0])
                }
                if (patterns.length > 1) {
                    const errorLoc = getNonWhitespaceLocByIndex(
                        valueStartSourceIndex,
                        valueStartSourceIndex + keywordIndex
                    )
                    TooManyBindingPatterns(errorLoc, rawName, 1)
                }
                if (!base.trim()) {
                    return ExpectedStringLiteral(getLocByIndex(baseStartSourceIndex))
                }

                // from 关键字后方的插槽名称必须是静态字符串字面量
                // The slot name following the `from` keyword must be a static string literal.
                const name = localAnalyzeInterpolation(base, baseStartSourceIndex)
                if (
                    name?.type !== "StringLiteral" &&
                    (name?.type !== "TemplateLiteral" || name.expressions.length)
                ) {
                    ;(keywordIndex === -1 ? ExpectedStringLiteral : InvalidSlotName)(
                        getNonWhitespaceLocByIndex(
                            baseStartSourceIndex,
                            baseStartSourceIndex + base.length
                        )
                    )
                }
            }
            return
        }

        case "#for": {
            if (directive.valueEnclosure !== "none") {
                const { patterns, keywordIndex, base, baseStartSourceIndex } = parseDirectiveValue(
                    rawValue,
                    "of",
                    valueStartSourceIndex
                )
                for (const pattern of patterns) {
                    recordContextIdentifiers(pattern)
                }
                if (patterns.length > 2) {
                    const errorLoc = getNonWhitespaceLocByIndex(
                        valueStartSourceIndex,
                        valueStartSourceIndex + keywordIndex
                    )
                    TooManyBindingPatterns(errorLoc, rawName, 2)
                }
                localAnalyzeInterpolation(base, baseStartSourceIndex)
            }
            return
        }

        case "#then":
        case "#catch": {
            const expectedList = ["#await", rawName === "#then" ? "#catch" : "#then"]
            if (
                !expectedList.includes(getFirstDirectiveNameOfPrevNonTextNode(node)) &&
                !nodeInfo.sortedDirectives.some(item => expectedList.includes(item.name.raw))
            ) {
                MissingPrecedingDirective(directive.name.loc, rawName, expectedList, true)
            }

            if (directive.valueEnclosure !== "none") {
                const pattern = parseContextPattern(rawValue)
                if (pattern) {
                    recordContextIdentifiers(pattern)
                } else {
                    InvalidContextPatternForDirective(
                        getNonWhiteSpaceLocByLoc(directive.value.loc),
                        rawName
                    )
                }
            }
            return
        }

        case "#key": {
            if (!nodeInfo.attributesMap["#for"]) {
                InvalidKeyDirectivePlacement(nameLoc)
            }
            break
        }

        case "#target": {
            if (node.parent && node.parent.componentTag) {
                InvalidTargetDirectivePlacement(nameLoc)
            }
            break
        }

        case "#html": {
            if (!node.children.length) {
                HtmlDirectiveRequiresSingleTextChild(node.loc)
            } else if (
                !isNonEmptyExpression(rawValue) &&
                !node.children[0].content.some(item => item.isInterpolated)
            ) {
                UnnecessaryHtmlDirective(directive.loc)
            }
            break
        }

        case "#else":
        case "#elif": {
            if (rawName === "#else" && directive.valueEnclosure !== "none") {
                RedundantDirectiveValue(directive.loc, rawName)
            }
            const expectedList = ["#if", "#elif"]
            if (!expectedList.includes(getFirstDirectiveNameOfPrevNonTextNode(node))) {
                MissingPrecedingDirective(nameLoc, rawName, expectedList, false)
            }
            break
        }
    }

    if (shouldAnalyzeAttributeValue(directive)) {
        localAnalyzeInterpolation(rawValue, valueStartSourceIndex)
    }

    // 将指令产生的上下边标识符记录到节点
    // Record the upper and lower edge identifiers generated by the directive on the node.
    function recordContextIdentifiers(pattern: ContextPattern | null) {
        let validIdentifierCount = 0
        if (pattern) {
            if (inputDescriptor.options.sourcemap) {
                walk(pattern, {
                    AnyNode(node) {
                        markNeedSourcemap(node, valueStartSourceIndex)
                    }
                })
            }
            walkPatternIdentifiers(pattern, ({ name }) => {
                validIdentifierCount++
                nodeInfo.contextIdentifiers.add(name)
            })
        }
        if (pattern && !validIdentifierCount) {
            EmptyContextPattern(
                getNonWhitespaceLocByIndex(
                    valueStartSourceIndex + pattern.start!,
                    valueStartSourceIndex + pattern.end!
                )
            )
        }

        const { parsedPatterns } = analyzeResult.template
        parsedPatterns.has(directive) || parsedPatterns.set(directive, [])
        parsedPatterns.get(directive)!.push(validIdentifierCount ? pattern : null)
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
    return getPrevNonTextNodeInfo(node)?.sortedDirectives[0].name.raw ?? ""
}
