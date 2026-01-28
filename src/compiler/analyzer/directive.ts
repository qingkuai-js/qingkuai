import type { ContextPattern } from "#type-declarations/estree"
import type { TemplateAttribute, TemplateNode } from "#type-declarations/compiler"

import {
    UnrecognizedDirective,
    MissingDirectiveValue,
    InvalidForDirectiveValue,
    MissingPrecedingDirective,
    DirectiveValueMustBePattern
} from "../message/error"
import { analyzeResult } from "../state"
import { parsePattern } from "../parser/script"
import { analyzeInterpolation } from "./interpolation"
import { RedundantAttributeValue } from "../message/warn"
import { getPrevNonTextNode } from "../../util/compiler/template"
import { findOutOfLiteralComment } from "../../util/compiler/string"
import { walkPatternIdentifiers } from "../../util/compiler/estree/walk"
import { DIRECTIVE_LIST, REQUIRED_VALUE_DIRECTIVES } from "../constants"
import { isAttributeValid, isNonEmptyExpression } from "../../util/compiler/assert"
import { getNonWhitespaceLocByIndex, getNonWhiteSpaceLocByLoc } from "../../util/compiler/position"

export function analyzeDirective(node: TemplateNode, directive: TemplateAttribute) {
    const directiveName = directive.name.raw
    const directiveValue = directive.value.raw
    const nodeInfo = analyzeResult.template.nodeInfos.get(node)!
    const valueStartSourceIndex = directive.value.loc.start.index

    // 缺少指令值
    // Missing directive value.
    if (REQUIRED_VALUE_DIRECTIVES.has(directiveName) && !directive.equalSign) {
        MissingDirectiveValue(directive.loc, directiveName)
    }

    // 未知指令
    // Unrecognized directives.
    if (!DIRECTIVE_LIST.has(directiveName)) {
        if (isAttributeValid(directive) && isNonEmptyExpression(directiveValue)) {
            analyzeInterpolation(node, directive, directiveValue, valueStartSourceIndex)
        }
        return UnrecognizedDirective(directive.loc, directiveName)
    }

    switch (directiveName) {
        case "#for": {
            let base = directiveValue
            let baseStartSourceIndex = valueStartSourceIndex
            const separatorIndex = findOutOfLiteralComment(directiveValue, " of ")
            if (separatorIndex !== -1) {
                const pattern = parsePattern(`[${directiveValue.slice(0, separatorIndex)}]`)
                if (pattern && pattern.type === "ArrayPattern" && pattern.elements.length) {
                    recordContextIdentifiers(pattern)
                } else {
                    InvalidForDirectiveValue(
                        getNonWhitespaceLocByIndex(
                            valueStartSourceIndex,
                            valueStartSourceIndex + separatorIndex + 1
                        )
                    )
                }
                baseStartSourceIndex += separatorIndex + 4
                base = directiveValue.slice(separatorIndex + 4)
            }
            return analyzeInterpolation(node, directive, base, baseStartSourceIndex, false)
        }

        case "#then":
        case "#catch": {
            const expectedList = ["#await", directiveName === "#then" ? "#catch" : "#then"]
            if (
                !nodeInfo.directives.some(item => expectedList.includes(item)) &&
                !expectedList.includes(getPrevNonTextNodeInfo(node)?.directives[0] ?? "")
            ) {
                MissingPrecedingDirective(directive.name.loc, directiveName, expectedList, true)
            }
            return checkWhetherDirectiveValueIsValidPattern()
        }

        case "#else":
        case "#elif": {
            const expectedList = ["#if", "#elif"]
            if (!expectedList.includes(getPrevNonTextNodeInfo(node)?.directives[0] ?? "")) {
                MissingPrecedingDirective(directive.name.loc, directiveName, expectedList, false)
            }
            return
        }

        case "#slot": {
            return checkWhetherDirectiveValueIsValidPattern()
        }

        default: {
            if (directiveName === "#else") {
                RedundantAttributeValue(directive.loc, directiveName)
            }
            if (isAttributeValid(directive) && isNonEmptyExpression(directiveValue)) {
                analyzeInterpolation(node, directive, directiveValue, valueStartSourceIndex)
            }
            return
        }
    }

    function recordContextIdentifiers(pattern: ContextPattern) {
        walkPatternIdentifiers(pattern, ({ name }) => {
            nodeInfo.contextIdentifiers.add(name)
        })
        analyzeResult.template.parsedPatterns.set(directive, pattern)
    }

    // 检查指令值是否是有效的绑定模式：#then, #catch, #slot 指令值必须是绑定模式
    // Check whether the directive value is a valid binding pattern:
    // the values of `#then`, `#catch`, and `#slot` directives must be binding patterns.
    function checkWhetherDirectiveValueIsValidPattern() {
        const pattern = parsePattern(directiveValue)
        if (pattern) {
            recordContextIdentifiers(pattern)
        } else {
            DirectiveValueMustBePattern(
                getNonWhiteSpaceLocByLoc(directive.value.loc),
                directiveName
            )
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
