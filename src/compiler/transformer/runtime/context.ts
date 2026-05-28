import type { RuntimeCodeWriter } from "../writer"
import type { ParsedPattern, TemplateAttribute } from "#type-declarations/compiler"

import { CodeEditor } from "../editor"
import { generateIdentifier, inputDescriptor } from "../../state"
import { isArrayBindingNameIdentifier } from "../../ts-ast/assert"
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
        if (isDebugMode || pattern.node) {
            declaredIds.push(...pattern.declaredIdentifiers)
        }
    }
    if (!declaredIds.length) {
        return writer
    }

    if (!isDebugMode) {
        const hasDestructuring = patterns.some(
            pattern => !isArrayBindingNameIdentifier(pattern.node)
        )
        if (!hasDestructuring) {
            return writer
        }
    }

    const setterId = (parsedDirective.context!.returnsId = ensureIdWithNumSuffix("_S"))
    writer.wrapLine().write(`let ${declaredIds.join(", ")};`)
    writer.wrapLine().write(`const ${setterId} = ${setterArgId} => (`)
    writer.write(multiPatterns ? "[" : "")
    writeContextPatterns(writer, patterns, true, !isDebugMode)
    writer.write(multiPatterns ? "]" : "").write(` = `)
    writer.write(multiPatterns ? "[" : "")

    for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i]
        const shouldWrite = isDebugMode || !isArrayBindingNameIdentifier(pattern.node)
        if (i && shouldWrite) {
            writer.write(", ")
        }
        if (shouldWrite) {
            writer.write(`${setterArgId}.${i === 0 ? "m" : "x"}`)
        }
    }
    return writer.writeLine(multiPatterns ? "])" : ")").writeLine(`${setterId}(${contextId})`)
}

export function writeContextPatterns(
    writer: RuntimeCodeWriter,
    patterns: ParsedPattern[],
    omitNull = false,
    destructuring = false
) {
    for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i]
        const shouldWrite = !destructuring || !isArrayBindingNameIdentifier(pattern.node)
        if (i && shouldWrite) {
            writer.write(", ")
        }
        if (pattern.node) {
            if (shouldWrite) {
                writer.writeEditedScript(
                    new CodeEditor(
                        inputDescriptor.source.slice(...pattern.sourceRange),
                        pattern.sourceRange[0]
                    )
                )
            }
        } else if (!omitNull) {
            writer.write(generateIdentifier.getterArg)
        }
    }
    return writer
}
