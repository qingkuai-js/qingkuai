import type {
    ParsedPattern,
    TemplateAttribute,
    TemplateNodeContext
} from "#type-declarations/compiler"
import type { RuntimeCodeWriter } from "../writer"

import { CodeEditor } from "../editor"
import { getLocByIndex } from "../../../util/compiler/position"
import { generateIdentifier, inputDescriptor } from "../../state"
import { getParsedPatterns } from "../../../util/compiler/template"
import { ensureIdWithNumSuffix } from "../../../util/compiler/sundry"

export function generateContextDeclaration(
    writer: RuntimeCodeWriter,
    nodeContext: TemplateNodeContext,
    directive: TemplateAttribute
) {
    const declaredIds: string[] = []
    const pureMark = "/* @__PURE__ */"
    const patterns = getParsedPatterns(directive)!
    const internalId = generateIdentifier.internal
    const isForDirective = directive.name.raw === "#for"
    const contextGetterId = generateIdentifier.contextGetter
    const directiveValueStartIndex = directive.value.loc.start.index
    for (const pattern of patterns) {
        if (pattern.node?.type === "Identifier") {
            declaredIds.push(pattern.node.name)
        } else {
            declaredIds.push(...pattern.declaredIdentifiers!)
        }
    }
    if (!declaredIds.length) {
        return writer
    }

    const isDebugMode = inputDescriptor.options.debug
    const destructuring = isForDirective || patterns[0].node?.type !== "Identifier"
    if (!isDebugMode) {
        if (!destructuring) {
            writer.wrapLine().write("const ")
            writeParsedPatterns(writer, patterns)
            return writer.write(` = ${pureMark} ${internalId}.derived(${contextGetterId})`)
        }

        writer.wrapLine().write(`const [${declaredIds.join(", ")}] = `)
        writer.write(`${pureMark} ${internalId}.destructuringDerived((`)
        writer.write(isForDirective ? "[" : "")
        writeParsedPatterns(writer, patterns)
        writer.write(isForDirective ? "]" : "")
        writer.write(`) => [${declaredIds.join(", ")}], `)
        return writer.write(`${contextGetterId}, ${declaredIds.length})`)
    }

    const declaredIdPairs = declaredIds.map(id => {
        return `[${nodeContext.contextIdentifiers[id]}, ${id}]`
    })
    if (!destructuring) {
        const patternSourceLoc = getLocByIndex(
            directiveValueStartIndex,
            directiveValueStartIndex + declaredIds[0].length
        )
        const setterId = generateSetterDeclaration(writer, declaredIds[0])
        writer.wrapLine(2).write(`let `)
        writer.writeTemplateStr(declaredIdPairs[0], patternSourceLoc)
        writer.write(` = ${pureMark} ${internalId}.derived(${contextGetterId}, ${setterId})`)
        return writer.wrapLine()
    }

    const setterIds: string[] = []
    for (const id of declaredIds) {
        setterIds.push(generateSetterDeclaration(writer, id))
    }
    writer.wrapLine(2).write(`let [${declaredIdPairs.join(", ")}]`)
    writer.write(` = ${pureMark} ${internalId}.destructuringDerived((`)
    writer.write(isForDirective ? "[" : "")
    writeParsedPatterns(writer, patterns)
    writer.write(isForDirective ? "]" : "")
    writer.write(`) => [${declaredIds.join(", ")}], ${contextGetterId}`)
    return writer.writeLine(`, ${declaredIds.length}, [${setterIds.join(", ")}])`)
}

export function writeParsedPatterns(writer: RuntimeCodeWriter, patterns: ParsedPattern[]) {
    for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i]
        if (pattern.node) {
            writer.writeEditedScript(
                new CodeEditor(
                    inputDescriptor.source.slice(...pattern.sourceRange),
                    pattern.sourceRange[0]
                )
            )
        }
        if (i < patterns.length - 1) {
            writer.write(", ")
        }
    }
    return writer
}

function generateSetterDeclaration(writer: RuntimeCodeWriter, target: string) {
    const setterId = ensureIdWithNumSuffix("_S")
    const setterArgId = generateIdentifier.setterArg
    writer.wrapLine().write(`const ${setterId} = ${setterArgId} => (`)
    return (writer.write(`${target} = ${setterArgId})`), setterId)
}
