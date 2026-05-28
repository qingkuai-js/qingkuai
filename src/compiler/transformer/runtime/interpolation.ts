import type { RuntimeCodeWriter } from "../writer"
import type { TemplateNode } from "#type-declarations/compiler"

import { CodeEditor } from "../editor"
import { analyzeResult } from "../../state"
import { traverseObject } from "../../../util/shared/sundry"
import { isArrayBindingNameIdentifier } from "../../ts-ast/assert"
import { getMaybeReusedString, replaceReusedStringReferences } from "../../optimizer/compress"
import { getGeneratedStaticTextContent, getParsedExpression } from "../../../util/compiler/template"

export function writeParsedExpression(writer: RuntimeCodeWriter, key: any, sourcemap = true) {
    const parsedExpression = getParsedExpression(key)!
    const editor = new CodeEditor(parsedExpression.source, parsedExpression.startSourceIndex)
    replaceReusedStringReferences(editor, parsedExpression.reusedStringReferences)
    traverseObject(parsedExpression.topLevelReferences, (key, value) => {
        const topLevelIdentifier = analyzeResult.script.topLevelIdentifiers[key]
        if (topLevelIdentifier && topLevelIdentifier.transformTo) {
            for (const reference of value) {
                if (reference.shorthand) {
                    editor.insert(reference.range[1], `: ${topLevelIdentifier.transformTo}`)
                } else {
                    editor.replace(...reference.range, topLevelIdentifier.transformTo, true)
                }
            }
        }
    })
    for (const reference of parsedExpression.contextReferences) {
        const parsedPattern = reference.pattern
        if (!isArrayBindingNameIdentifier(parsedPattern.node)) {
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
    if (sourcemap) {
        return writer.writeEditedScript(editor)
    } else {
        return writer.write(editor.result)
    }
}

export function transformInterpolatedText(writer: RuntimeCodeWriter, node: TemplateNode) {
    if (!node.content.length) {
        return getMaybeReusedString("")
    }

    let partCount = 0
    let singlePart = node.content[0]
    for (let i = 0; i < node.content.length; i++) {
        const part = node.content[i]
        if (part.isInterpolated || getGeneratedStaticTextContent(part)) {
            partCount++
            singlePart = part

            if (partCount > 1) {
                break
            }
        }
    }

    if (partCount === 1) {
        if (singlePart.isInterpolated) {
            return writeParsedExpression(writer, singlePart)
        }
        return writer.write(getMaybeReusedString(getGeneratedStaticTextContent(singlePart)!))
    }

    for (let i = 0, j = 0; i < node.content.length; i++) {
        const part = node.content[i]
        if (part.isInterpolated) {
            if (!j++) {
                writer.write(getMaybeReusedString(""))
            }
            writer.write(" + (")
            writeParsedExpression(writer, part).write(")")
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
