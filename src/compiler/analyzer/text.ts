import type { TemplateNode, TextContentPart } from "#type-declarations/compiler"

import { WhitespaceMode } from "../enums"
import { getLastElem } from "../../util/shared/arrays"
import { analyzeResult, inputDescriptor } from "../state"
import { atLeastOneWhitespaceRE, nonWhitespaceRE } from "../regular"

export function analyzeStaticTextContent(node: TemplateNode, part: TextContentPart) {
    let str = part.value

    const isFirst = node.content[0] === part
    const isLast = getLastElem(node.content) === part
    const withInComponent = !!node.parent?.componentTag
    const whitespaceRule = inputDescriptor.options.whitespace
    if (!node.parent?.preWhiteSpace && !withInComponent) {
        if (!nonWhitespaceRE.test(str)) {
            switch (whitespaceRule) {
                case WhitespaceMode.Collapse: {
                    str = " "
                    break
                }
                case WhitespaceMode.Trim:
                case WhitespaceMode.TrimCollapse: {
                    str = isFirst || isLast ? "" : " "
                    break
                }
            }
        } else {
            switch (whitespaceRule) {
                case WhitespaceMode.Collapse: {
                    str = str.replaceAll(atLeastOneWhitespaceRE, " ")
                    break
                }
                case WhitespaceMode.TrimCollapse: {
                    str = str.replaceAll(atLeastOneWhitespaceRE, " ")
                    // fallthrough
                }
                case WhitespaceMode.Trim: {
                    if (isFirst) {
                        str = str.trimStart()
                    }
                    if (isLast) {
                        str = str.trimEnd()
                    }
                    break
                }
            }
        }
    }
    if (withInComponent && !str.trim()) {
        str = ""
    }
    analyzeResult.template.staticTextContents.set(part, str)
}
