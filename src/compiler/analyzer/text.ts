import type { TemplateNode, TextContentPart } from "#type-declarations/compiler"

import { getLastElem } from "../../util/shared/arrays"
import { analyzeResult, inputDescriptor } from "../state"
import { atLeastOneWhitespaceRE, nonWhitespaceRE } from "../regular"
import { increaseReusedStringUsedTimes } from "../transformer/runtime/compress"

export function analyzeStaticTextContent(node: TemplateNode, part: TextContentPart) {
    let str = part.value

    const isFirst = node.content[0] === part
    const isLast = getLastElem(node.content) === part
    const withInComponent = !!node.parent?.componentTag
    const whitespaceRule = inputDescriptor.options.whitespace
    if (!node.parent?.preWhiteSpace && !withInComponent) {
        if (!nonWhitespaceRE.test(str)) {
            switch (whitespaceRule) {
                case "collapse": {
                    str = " "
                    break
                }
                case "trim":
                case "trim-collapse": {
                    str = isFirst || isLast ? "" : " "
                    break
                }
            }
        } else {
            switch (whitespaceRule) {
                case "collapse": {
                    str = str.replaceAll(atLeastOneWhitespaceRE, " ")
                    break
                }
                case "trim-collapse": {
                    str = str.replaceAll(atLeastOneWhitespaceRE, " ")
                    // fallthrough
                }
                case "trim": {
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
    if (str) {
        increaseReusedStringUsedTimes(str)
    }
    analyzeResult.template.staticTextContents.set(part, str)
}
