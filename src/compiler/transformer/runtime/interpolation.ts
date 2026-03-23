import type { RuntimeCodeWriter } from "../writer"
import type { TemplateNode } from "#type-declarations/compiler"

import { CodeEditor } from "../editor"
import { analyzeResult } from "../../state"
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
    for (const reference of parsedExpression.contextReferences) {
        const parsedPattern = reference.pattern
        if (!parsedPattern || parsedPattern.node!.type !== "Identifier") {
            continue
        }

        const parsedDirective = parsedPattern.directive
        if (!parsedDirective.context) {
            continue
        }

        const contextKey = parsedPattern === parsedDirective.patterns[0] ? "m" : "x"
        const transformed = `${parsedDirective.context.argId}.${contextKey}`
        if (reference.shorthand) {
            editor.insert(reference.range[1], `: ${transformed}`)
        } else {
            editor.replace(...reference.range, `${transformed}`, true)
        }
    }
    return writer.writeEditedScript(editor)
}

export function transformInterpolatedText(writer: RuntimeCodeWriter, node: TemplateNode) {
    if (!node.content.length) {
        return getMaybeReusedString("")
    }
    for (let i = 0, j = 0; i < node.content.length; i++) {
        const part = node.content[i]
        if (part.isInterpolated) {
            if (!j++) {
                writer.write(getMaybeReusedString(""))
            }
            writer.write(" + ")
            transformParsedExpression(writer, part)
        } else {
            const generated = getGeneratedStaticTextContent(part)
            if (!generated) {
                continue
            }
            if (j++) {
                writer.write(" + ")
            }
            writer.write(getMaybeReusedString(generated))
        }
    }
}
