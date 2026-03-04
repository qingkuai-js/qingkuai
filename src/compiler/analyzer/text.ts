import type { TemplateNode, TextContentPart } from "#type-declarations/compiler"

import { analyzeResult, inputDescriptor } from "../state"
import { atLeastOneWhitespaceRE, nonWhitespaceRE } from "../regular"

export function analyzeStaticTextContent(node: TemplateNode, part: TextContentPart) {
    let str = node.componentTag ? part.value.trim() : part.value
    const whitespaceRule = inputDescriptor.options.whitespace
    if (!node.parent?.preWhiteSpace && !node.componentTag) {
        if (!nonWhitespaceRE.test(str)) {
            switch (whitespaceRule) {
                case "collapse": {
                    str = " "
                    break
                }
                case "trim":
                case "trim-collapse": {
                    str = ""
                    break
                }
            }
        } else {
            switch (whitespaceRule) {
                case "trim": {
                    str = str.trim()
                    break
                }
                case "collapse": {
                    str = str.replace(atLeastOneWhitespaceRE, " ")
                    break
                }
                case "trim-collapse": {
                    str = str.trim().replace(atLeastOneWhitespaceRE, " ")
                }
            }
        }
    }
    analyzeResult.template.staticTextContents.set(part, str)
}
