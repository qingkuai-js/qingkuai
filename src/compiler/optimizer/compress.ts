import type { CodeEditor } from "../transformer/editor"
import type { RuntimeCodeWriter } from "../transformer/writer"
import type { TemplateFragment } from "#type-declarations/compiler"
import type { StringLiteralDetail, ReusedStringReference } from "#type-declarations/compiler"

import ts from "typescript"

import { stringify } from "../../util/shared/aliases"
import { isUndefined } from "../../util/shared/assert"
import { ensureIdWithNumSuffix } from "../../util/compiler/sundry"
import { isValidIdentifierName } from "../../util/compiler/assert"
import { newCleanObj, traverseObject } from "../../util/shared/sundry"
import { analyzeResult, generateIdentifier, inputDescriptor } from "../state"
import { getNodeRange } from "../ts-ast/sundry"

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
        if (fragment.getWith) {
            continue
        }
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
        if (fragment.getWith) {
            continue
        }

        for (let i = 0; i < fragment.content.length; i++) {
            const compressStringIndex = compressStringIndexMap.get(fragment.content[i])
            if (!isUndefined(compressStringIndex)) {
                fragment.usedCompressString = true
                break
            }
        }

        if (fragment.usedCompressString) {
            for (let i = 0; i < fragment.content.length; i++) {
                const str = fragment.content[i]
                const compressStringIndex = compressStringIndexMap.get(str)
                fragment.content[i] = fragment.content[i].replaceAll("|", "||")

                if (!isUndefined(compressStringIndex)) {
                    increaseReusedStringUsedTimes(str)
                    fragment.content[i] = "|" + compressStringIndex
                }
            }
        }
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
    writer.write(`const ${generateIdentifier.compressStrings} = [`)

    if (shouldWrapLine) {
        writer.indent()
    }
    compressStringIndexMap.forEach((index, str) => {
        writer.write(getMaybeReusedString(str))
        if (index !== compressStringIndexMap.size - 1) {
            writer.write(", ")
        }
        if (shouldWrapLine) {
            writer.write("\n")
        }
    })
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

export function replaceReusedStringReferences(
    editor: CodeEditor,
    references: ReusedStringReference[]
) {
    for (const reference of references) {
        const literalId = getMaybeReusedString(reference.value)
        if (literalId) {
            editor.replace(
                ...reference.range,
                reference.computed ? `[${literalId}]` : literalId,
                true
            )
        }
    }
}

export function increaseReusedStringUsedTimes(value: string, isPropertyName = false) {
    if (
        inputDescriptor.options.debug ||
        inputDescriptor.options.checkMode ||
        (isPropertyName && isValidIdentifierName(value, true) && value.length < 3)
    ) {
        return
    }

    analyzeResult.reusedStrings[value] ??= {
        id: "",
        times: 0
    }
    analyzeResult.reusedStrings[value].times++
}

export function collectReusedStringReference(node: ts.Node, references: ReusedStringReference[]) {
    const detail = getTransformableStringLiteralValue(node)
    if (isUndefined(detail)) {
        return
    }
    references.push({
        value: detail.value,
        computed: detail.computed,
        range: getNodeRange(node)
    })
    increaseReusedStringUsedTimes(detail.value, detail.propertyName)
}

function getTransformableStringLiteralValue(node: ts.Node): StringLiteralDetail | undefined {
    if (!ts.isStringLiteral(node) && !ts.isNoSubstitutionTemplateLiteral(node)) {
        return
    }

    switch (node.parent.kind) {
        case ts.SyntaxKind.EnumMember:
        case ts.SyntaxKind.LiteralType:
        case ts.SyntaxKind.MethodSignature:
        case ts.SyntaxKind.ImportDeclaration:
        case ts.SyntaxKind.ExportDeclaration:
        case ts.SyntaxKind.ModuleDeclaration:
        case ts.SyntaxKind.PropertySignature: {
            return
        }

        case ts.SyntaxKind.ComputedPropertyName: {
            const grandParent = node.parent.parent
            if (ts.isPropertySignature(grandParent) || ts.isMethodSignature(grandParent)) {
                return
            }
            return {
                value: node.text,
                computed: false,
                propertyName: false
            }
        }

        default: {
            if (
                ts.isMethodDeclaration(node.parent) ||
                ts.isPropertyDeclaration(node.parent) ||
                ts.isPropertyAssignment(node.parent) ||
                ts.isGetAccessorDeclaration(node.parent) ||
                ts.isSetAccessorDeclaration(node.parent)
            ) {
                if (node.parent.name !== node) {
                    return
                }
                return {
                    value: node.text,
                    computed: true,
                    propertyName: true
                }
            }
        }
    }
    return {
        value: node.text,
        computed: false,
        propertyName: false
    } satisfies StringLiteralDetail
}
