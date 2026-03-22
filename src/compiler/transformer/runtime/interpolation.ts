import type { RuntimeCodeWriter } from "../writer"
import type { TemplateNode } from "#type-declarations/compiler"

import { CodeEditor } from "../editor"
import { analyzeResult } from "../../state"
import { stringify } from "../../../util/shared/aliases"
import { traverseObject } from "../../../util/shared/sundry"
import { getMaybeReusedString } from "../../../util/compiler/sundry"
import { getGeneratedStaticTextContent, getParsedExpression } from "../../../util/compiler/template"

export function transformParsedExpression(writer: RuntimeCodeWriter, key: any) {
    const parsedExpression = getParsedExpression(key)!
    const editor = new CodeEditor(parsedExpression.source, parsedExpression.startSourceIndex)
    for (const literal of parsedExpression.stringLiterals) {
        if (analyzeResult.reusedStrings[literal.value]?.id) {
            editor.replace(...literal.range!, analyzeResult.reusedStrings[literal.value].id, true)
        }
    }
    traverseObject(parsedExpression.topLevelReferences, (key, value) => {
        const topLevelIdentifier = analyzeResult.script.topLevelIdentifiers[key]
        if (topLevelIdentifier && topLevelIdentifier.transofrmedTo) {
            for (const reference of value) {
                if (reference.shorthand) {
                    editor.insert(reference.range[1], `: ${topLevelIdentifier.transofrmedTo}`)
                } else {
                    editor.replace(...reference.range, topLevelIdentifier.transofrmedTo, true)
                }
            }
        }
    })
    for (const reference of parsedExpression.reactiveContextReferences) {
        if (reference.shorthand) {
            editor.insert(reference.range[1], `: ${reference.reactiveId}.$`)
        } else {
            editor.replace(...reference.range, reference.reactiveId + ".$", true)
        }
    }
    return writer.writeEditedScript(editor)
}

export function transformInterpolatedText(writer: RuntimeCodeWriter, node: TemplateNode) {
    if (!node.content.length) {
        return getMaybeReusedString("")
    }
    if (node.content[0].isInterpolated) {
        writer.write(getMaybeReusedString("") + " + ")
    }
    for (const part of node.content) {
        if (part !== node.content[0]) {
            writer.write(" + ")
        }
        if (part.isInterpolated) {
            transformParsedExpression(writer, part)
        } else {
            writer.write(stringify(getGeneratedStaticTextContent(part)))
        }
    }
}
