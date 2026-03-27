import type { RuntimeCodeWriter } from "../writer"
import type { TemplateFragment } from "#type-declarations/compiler"

import { isValidIdentifier } from "@babel/types"
import { stringify } from "../../../util/shared/aliases"
import { isUndefined } from "../../../util/shared/assert"
import { newCleanObj, traverseObject } from "../../../util/shared/sundry"
import { analyzeResult, generateIdentifier, inputDescriptor } from "../../state"
import { ensureIdWithNumSuffix, ensureIdWithPrefix } from "../../../util/compiler/sundry"

export function writeStringLiteralsDeclarations(
    writer: RuntimeCodeWriter,
    fragments: TemplateFragment[]
) {
    if (inputDescriptor.options.debug || inputDescriptor.options.checkMode) {
        return writer
    }

    let extractedReusedString = false
    const compressStringIndexMap = new Map<string, number>()
    const fragmentContentPartUsedTimes: Record<string, number> = newCleanObj()
    for (const fragment of fragments) {
        for (let i = 0; i < fragment.content.length; i++) {
            const str = fragment.content[i]
            fragmentContentPartUsedTimes[str] = (fragmentContentPartUsedTimes[str] ?? 0) + 1
        }
    }
    traverseObject(fragmentContentPartUsedTimes, (str, times) => {
        if (times > 1 && str.length > Math.floor(compressStringIndexMap.size / 10) + 2) {
            compressStringIndexMap.set(str, compressStringIndexMap.size)
        }
    })

    for (const fragment of fragments) {
        for (let i = 0; i < fragment.content.length; i++) {
            const compressStringIndex = compressStringIndexMap.get(fragment.content[i])
            if (isUndefined(compressStringIndex)) {
                fragment.content[i] = fragment.content[i].replaceAll("/", "//")
                continue
            }
            fragment.usedCompressString = true
            fragment.content[i] = "/" + compressStringIndex
        }
    }
    for (const [str] of compressStringIndexMap) {
        increaseReusedStringUsedTimes(str)
    }
    traverseObject(analyzeResult.reusedStrings, (str, info) => {
        if (info.times > 1) {
            extractedReusedString = true
            info.id = ensureIdWithNumSuffix("_s")
            writer.writeLine(`const ${info.id} = ${JSON.stringify(str)}`)
        }
    })
    if (!compressStringIndexMap.size) {
        if (extractedReusedString) {
            writer.wrapLine()
        }
        return writer
    }

    const shouldWrapLine = compressStringIndexMap.size > 8
    const compressStringId = ensureIdWithPrefix("compressStrings")
    writer.write(`const ${(generateIdentifier.compressStrings = compressStringId)} = [`)

    if (shouldWrapLine) {
        writer.indent()
    }
    for (const [str] of compressStringIndexMap) {
        writer.write(`${getMaybeReusedString(str)},${shouldWrapLine ? "\n" : " "}`)
    }
    if (shouldWrapLine) {
        writer.dedent()
    }
    return writer.writeLine("]").wrapLine()
}

export function getMaybeReusedString(value: string) {
    const literalId = analyzeResult.reusedStrings[value]?.id
    if (!literalId) {
        return stringify(value)
    }
    if (!inputDescriptor.options.interpretiveComments || !value.trim()) {
        return literalId
    }
    return `/* ${value} */ ${literalId}`
}

export function increaseReusedStringUsedTimes(value: string, isPropertyName = false) {
    if (
        inputDescriptor.options.debug ||
        inputDescriptor.options.checkMode ||
        (isPropertyName && isValidIdentifier(value, true) && value.length < 3)
    ) {
        return
    }

    analyzeResult.reusedStrings[value] ??= {
        id: "",
        times: 0
    }
    analyzeResult.reusedStrings[value].times++
}
