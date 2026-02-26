import type { TemplateNode, TextContentPart } from "#type-declarations/compiler"

import { getLastElem } from "../../util/shared/arrays"
import { analyzeResult, inputDescriptor } from "../state"
import { nonWhitespaceRE, textContentReplacerRE } from "../regular"
import { increaseCompressStringUsedTimes } from "../../util/compiler/sundry"

export function analyzeStaticTextContent(node: TemplateNode, part: TextContentPart) {
    let str = part.value
    const compileOptions = inputDescriptor.options
    if (node.parent?.preWhiteSpace) {
        str = str.replaceAll("/", "//")
    } else {
        if (compileOptions.trimTextEdges) {
            if (part === node.content[0]) {
                str = str.trimStart()
            }
            if (part === getLastElem(node.content)) {
                str = str.trimEnd()
            }
        }
        if (!nonWhitespaceRE.test(str)) {
            str = compileOptions.collapseWhitespaceOnlyText ? " " : ""
        }
        str = str.replace(textContentReplacerRE, m => {
            return m === "/" ? "//" : " "
        })
    }
    increaseCompressStringUsedTimes(str)
    analyzeResult.template.staticTextContents.set(part, str)
}
