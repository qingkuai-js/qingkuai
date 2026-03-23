import type { RuntimeCodeWriter } from "../writer"
import type { ParsedPattern, TemplateAttribute } from "#type-declarations/compiler"

import { CodeEditor } from "../editor"
import { generateIdentifier, inputDescriptor } from "../../state"
import { getParsedDirective } from "../../../util/compiler/template"
import { ensureIdWithNumSuffix } from "../../../util/compiler/sundry"

export function writeContextDeclaration(writer: RuntimeCodeWriter, directive: TemplateAttribute) {
    const parsedDirective = getParsedDirective(directive)
    if (!parsedDirective?.context) {
        return writer
    }

    const declaredIds: string[] = []
    const patterns = parsedDirective.patterns
    const multiPatterns = patterns.length > 1
    const contextId = parsedDirective.context.argId
    const setterArgId = generateIdentifier.setterArg
    const isDebugMode = inputDescriptor.options.debug
    for (const pattern of patterns) {
        if (isDebugMode || (pattern.node && pattern.node.type !== "Identifier")) {
            declaredIds.push(...pattern.declaredIdentifiers)
        }
    }
    if (!declaredIds.length) {
        return writer
    }

    const setterId = (parsedDirective.context!.returnsId = ensureIdWithNumSuffix("_S"))
    writer.wrapLine().write(`let ${declaredIds.join(", ")};`)
    writer.wrapLine().write(`const ${setterId} = ${setterArgId} => (`)
    writer.write(multiPatterns ? "[" : "")
    writeContextPatterns(writer, patterns, true)
    writer.write(multiPatterns ? "]" : "").write(` = `)
    writer.write(multiPatterns ? "[" : "")

    for (let i = 0; i < patterns.length; i++) {
        writer.write(`${setterArgId}.${i === 0 ? "m" : "x"}`)

        if (i < patterns.length - 1) {
            writer.write(", ")
        }
    }
    return writer.writeLine(multiPatterns ? "])" : ")") .writeLine(`${setterId}(${contextId})`)
}

export function writeContextPatterns(
    writer: RuntimeCodeWriter,
    patterns: ParsedPattern[],
    omitNull = false
) {
    for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i]
        if (pattern.node) {
            writer.writeEditedScript(
                new CodeEditor(
                    inputDescriptor.source.slice(...pattern.sourceRange),
                    pattern.sourceRange[0]
                )
            )
        } else if (!omitNull) {
            writer.write(generateIdentifier.getterArg)
        }
        if (i < patterns.length - 1) {
            writer.write(", ")
        }
    }
    return writer
}
