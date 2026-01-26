import type { ContextPattern } from "#type-declarations/estree"
import type { TemplateAttribute, TemplateNode } from "#type-declarations/compiler"

import {
    UnrecognizedDirective,
    MissingPrecedingDirective,
    DirectiveValueMustBePattern,
    InvalidForDirectiveValue
} from "../message/error"
import { analyzeResult } from "../state"
import { DIRECTIVE_LIST } from "../constants"
import { parsePattern } from "../parser/script"
import { getPrevNonTextNode } from "../../util/compiler/template"
import { findOutOfStringComment } from "../../util/compiler/string"
import { walkPatternIdentifiers } from "../../util/compiler/estree/walk"
import { getNonWhitespaceLocByIndex, getNonWhiteSpaceLocByLoc } from "../../util/compiler/position"

export function analyzeDirective(node: TemplateNode, directive: TemplateAttribute) {
    const directiveName = directive.name.raw
    const directiveValue = directive.value.raw
    const directiveNameLoc = directive.name.loc
    const directiveValueLoc = directive.value.loc
    const { parsedPatterns } = analyzeResult.template
    const nodeInfo = analyzeResult.template.nodeInfos.get(node)!

    // 未知指令
    // Unrecognized directives.
    if (!DIRECTIVE_LIST.has(directiveName)) {
        UnrecognizedDirective(directive.loc, directiveName)
    }

    switch (directiveName) {
        case "#for": {
            if (!nodeInfo.attributesMap[directiveName].hasValue) {
                break
            }

            const separatorIndex = findOutOfStringComment(directiveValue, " of ")
            if (separatorIndex === -1) {
                break
            }

            const pattern = parsePattern(`[${directiveValue.slice(0, separatorIndex)}]`)
            if (pattern && pattern.type === "ArrayPattern" && pattern.elements.length) {
                recordContextIdentifiers(pattern)
            } else {
                InvalidForDirectiveValue(
                    getNonWhitespaceLocByIndex(
                        directiveValueLoc.start.index,
                        directiveValueLoc.start.index + separatorIndex + 1
                    )
                )
            }
            break
        }

        case "#then":
        case "#catch": {
            const expectedList = ["#await", directiveName === "#then" ? "#catch" : "#then"]
            if (!nodeInfo.directives.some(item => expectedList.includes(item))) {
                const prevNonTextNodeInfo = getPrevNonTextNodeInfo(node)
                if (
                    !prevNonTextNodeInfo ||
                    !expectedList.includes(prevNonTextNodeInfo.directives[0])
                ) {
                    MissingPrecedingDirective(directiveNameLoc, directiveName, expectedList, true)
                }
            }
            checkWhetherDirectiveValueIsValidPattern()
            break
        }

        case "#else":
        case "#elif": {
            const prevNonTextNodeInfo = getPrevNonTextNodeInfo(node)
            if (
                !prevNonTextNodeInfo ||
                !/#(?:el)?if/.test(prevNonTextNodeInfo.directives[0] ?? "")
            ) {
                MissingPrecedingDirective(directiveNameLoc, directiveName, ["#if", "#elif"], false)
            }
            break
        }

        case "#slot": {
            checkWhetherDirectiveValueIsValidPattern()
            break
        }
    }

    // 检查指令值是否是有效的绑定模式：#then, #catch, #slot 指令值必须是绑定模式
    // Check whether the directive value is a valid binding pattern:
    // the values of `#then`, `#catch`, and `#slot` directives must be binding patterns.
    function checkWhetherDirectiveValueIsValidPattern() {
        if (nodeInfo.attributesMap[directiveName].hasValue) {
            const pattern = parsePattern(directiveValue)
            if (pattern) {
                recordContextIdentifiers(pattern)
            } else {
                DirectiveValueMustBePattern(
                    getNonWhiteSpaceLocByLoc(directiveValueLoc),
                    directiveName
                )
            }
        }
    }

    function recordContextIdentifiers(pattern: ContextPattern) {
        walkPatternIdentifiers(pattern, ({ name }) => {
            nodeInfo.contextIdentifiers.add(name)
        })
        parsedPatterns.set(directive, pattern)
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
