import type {
    EstreeWalkContext,
    StringLiteralDetail,
    ReusedStringReference
} from "#type-declarations/compiler"
import type { CodeEditor } from "../transformer/editor"
import type { RuntimeCodeWriter } from "../transformer/writer"
import type { AnyNode, WithLoc } from "#type-declarations/estree"
import type { StringLiteral, TemplateLiteral } from "@babel/types"
import type { TemplateFragment } from "#type-declarations/compiler"

import { any } from "../../util/shared/sundry"
import { stringify } from "../../util/shared/aliases"
import { isUndefined } from "../../util/shared/assert"
import { ensureIdWithNumSuffix } from "../../util/compiler/sundry"
import { isValidIdentifierName } from "../../util/compiler/assert"
import { newCleanObj, traverseObject } from "../../util/shared/sundry"
import { analyzeResult, generateIdentifier, inputDescriptor } from "../state"

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

export function collectReusedStringReference(
    node: WithLoc<AnyNode>,
    context: EstreeWalkContext,
    references: ReusedStringReference[]
) {
    const detail = getTransformableStringLiteralValue(node, context)
    if (isUndefined(detail)) {
        return
    }

    increaseReusedStringUsedTimes(detail.value, detail.propertyName)
    references.push({
        value: detail.value,
        range: node.range!,
        computed: detail.computed
    })
}

export function replaceReusedStringReferences(
    editor: CodeEditor,
    references: ReusedStringReference[]
) {
    for (const reference of references) {
        const literalId = analyzeResult.reusedStrings[reference.value]?.id
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

function getTransformableStringLiteralValue(node: WithLoc<AnyNode>, context: EstreeWalkContext) {
    let value = ""
    switch (node.type) {
        case "StringLiteral": {
            value = (node as WithLoc<StringLiteral>).value
            break
        }
        case "TemplateLiteral": {
            const templateNode = node as WithLoc<TemplateLiteral>
            if (templateNode.expressions.length) {
                return
            }
            value = templateNode.quasis[0]?.value.cooked ?? ""
            break
        }
        default: {
            return
        }
    }

    if (isInTypeOnlyContext(node, context)) {
        return
    }

    const parentNode = context.parent?.value
    if (!parentNode) {
        return {
            value,
            computed: false,
            propertyName: false
        } satisfies StringLiteralDetail
    }

    switch (parentNode.type) {
        case "TSPropertySignature":
        case "TSMethodSignature": {
            if (node === any(parentNode).key && !any(parentNode).computed) {
                return
            }
            break
        }
        case "ObjectProperty":
        case "ObjectMethod":
        case "ClassMethod":
        case "ClassPrivateMethod":
        case "ClassProperty":
        case "ClassPrivateProperty":
        case "ClassAccessorProperty": {
            const isNonComputedKey = node === any(parentNode).key && !any(parentNode).computed
            if (isNonComputedKey) {
                if (value === "__proto__") {
                    return
                }
                return {
                    value,
                    computed: true,
                    propertyName: true
                } satisfies StringLiteralDetail
            }
            break
        }
        case "ImportDeclaration":
        case "ExportAllDeclaration":
        case "ExportNamedDeclaration":
        case "TSImportType":
        case "TSLiteralType": {
            return
        }
        case "TaggedTemplateExpression": {
            if (node === parentNode.quasi) {
                return
            }
            break
        }
        case "TSEnumMember":
        case "TSModuleDeclaration": {
            if (node === any(parentNode).id) {
                return
            }
            break
        }
    }

    return {
        value,
        computed: false,
        propertyName: false
    } satisfies StringLiteralDetail
}

function isInTypeOnlyContext(node: WithLoc<AnyNode>, context: EstreeWalkContext) {
    let child = node as AnyNode
    for (let current = context.parent; current; current = current.parent) {
        const currentNode = current.value as AnyNode
        switch (currentNode.type) {
            case "TSAsExpression":
            case "TSSatisfiesExpression":
            case "TSNonNullExpression":
            case "TSInstantiationExpression": {
                if (child === any(currentNode).expression) {
                    child = currentNode
                    continue
                }
                return true
            }
            case "TSTypeAssertion": {
                if (child === any(currentNode).expression) {
                    child = currentNode
                    continue
                }
                return true
            }
            case "TSEnumDeclaration":
            case "TSEnumMember": {
                return false
            }
            default: {
                if (currentNode.type.startsWith("TS")) {
                    return true
                }
                child = currentNode
            }
        }
    }
    return false
}
