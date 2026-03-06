import type { TemplateNode, TextContentPart } from "#type-declarations/compiler"

import { analyzeResult, inputDescriptor } from "../state"
import { atLeastOneWhitespaceRE, nonWhitespaceRE } from "../regular"

export function analyzeStaticTextContent(node: TemplateNode, part: TextContentPart) {
    let str = part.value

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
    if (withInComponent && !str.trim()) {
        str = ""
    }
    analyzeResult.template.staticTextContents.set(part, str)
}
