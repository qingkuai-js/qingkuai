import type { CodeWriter } from "../writer"
import type { TemplateNode } from "#type-declarations/compiler"
import type { ContextPattern } from "#type-declarations/estree"

import { CodeEditor } from "../editor"
import { stringify } from "../../../util/shared/aliases"
import { traverseObject } from "../../../util/shared/sundry"
import { analyzeResult, inputDescriptor } from "../../state"
import { getMaybeReusedString } from "../../../util/compiler/sundry"
import { getGeneratedStaticTextContent, getParsedExpression } from "../../../util/compiler/template"

export function generateContextPattern(
    writer: CodeWriter,
    node: ContextPattern,
    startSourceIndex: number
) {
    return writer.writeEditedScript(
        new CodeEditor(
            inputDescriptor.source.slice(
                startSourceIndex + node.start!,
                startSourceIndex + node.end!
            ),
            startSourceIndex + node.start!
        )
    )
}

export function transformParsedExpression(writer: CodeWriter, key: any) {
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
    return writer.writeEditedScript(editor)
}

export function transformInterpolatedText(writer: CodeWriter, node: TemplateNode) {
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
