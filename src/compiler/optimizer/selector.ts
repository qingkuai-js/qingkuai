import type {
    Range,
    TemplateNode,
    ParsedExpression,
    TemplateAttribute,
    TemplateNodeContext,
    GeneratedSelectorInfo
} from "#type-declarations/compiler"
import type { RuntimeCodeWriter } from "../transformer/writer"

import ts from "typescript"

import {
    getParsedDirective,
    getParsedExpression,
    getTemplateNodeContext
} from "../../util/compiler/template"
import { walkTsNode } from "../ts-ast/walk"
import { getMaybeReusedString } from "./compress"
import { CodeEditor } from "../transformer/editor"
import { analyzeResult, generateIdentifier } from "../state"
import { getStriptTypeOperationsNode } from "../ts-ast/sundry"
import { getAttributeBaseName, ensureIdWithNumSuffix } from "../../util/compiler/sundry"
import { isBindingReference, isExpressionEqual, isMemberAccessExpression } from "../ts-ast/assert"

export function getForBlockSelectorInfos(forNodeContext: TemplateNodeContext) {
    const keyDirective = forNodeContext.attributesMap["#key"]
    const forDirective = forNodeContext.attributesMap["#for"]
    if (!keyDirective || !forDirective) {
        return []
    }

    const parsedForDirective = getParsedDirective(forDirective)
    const parsedKeyExpression = getParsedExpression(keyDirective)
    if (!parsedForDirective || !parsedKeyExpression) {
        return []
    }
    if (!parsedForDirective.context?.argId) {
        return []
    }

    const keyNode = getStriptTypeOperationsNode(parsedKeyExpression.node)
    if (ts.isIdentifier(keyNode) && isMemberAccessExpression(keyNode)) {
        return []
    }

    const ret: GeneratedSelectorInfo[] = []
    walk(forNodeContext.node, node => {
        const nodeContext = getTemplateNodeContext(node)
        if (node.componentTag || node.tag === "slot") {
            return
        }

        if (node.tag === "") {
            const textPart = node.content.find(item => item.isInterpolated)
            if (!textPart) {
                return
            }

            const textExpression = getParsedExpression(textPart)
            if (!textExpression) {
                return
            }

            const selectorValidation = validateSelectorExpression(
                textExpression,
                parsedForDirective,
                parsedKeyExpression
            )
            if (!selectorValidation) {
                return
            }

            ret.push({
                keyDirective,
                forNodeContext,
                targetNodeContext: nodeContext,
                targetTextPart: textPart,
                expressionKey: textPart,
                operation: {
                    method: "setText"
                },
                id: ensureIdWithNumSuffix("_selector"),
                topLevelIdentifierName: selectorValidation.topLevelIdentifierName,
                topLevelTransformedTo: selectorValidation.topLevelTransformedTo
            })
            return
        }

        for (const attribute of nodeContext.dynamicAttributes) {
            const expression = getParsedExpression(attribute)
            if (!expression) {
                continue
            }

            const operation = getSelectorOperation(nodeContext, attribute)
            if (!operation) {
                continue
            }

            const selectorValidation = validateSelectorExpression(
                expression,
                parsedForDirective,
                parsedKeyExpression
            )
            if (!selectorValidation) {
                continue
            }

            ret.push({
                operation,
                keyDirective,
                forNodeContext,
                targetNodeContext: nodeContext,
                expressionKey: attribute,
                targetAttribute: attribute,
                id: ensureIdWithNumSuffix("_selector"),
                topLevelIdentifierName: selectorValidation.topLevelIdentifierName,
                topLevelTransformedTo: selectorValidation.topLevelTransformedTo
            })
        }
    })
    return ret
}

export function writeSelectorDeclaration(
    writer: RuntimeCodeWriter,
    info: GeneratedSelectorInfo,
    nodeGetterId: string
) {
    writer.wrapLine().write(`const ${info.id} = (() => {`).indent()
    writer.write(`let prevValue = ${info.topLevelTransformedTo}`)
    writer.wrapLine().write("return key => {").indent()
    writer.write("if (key !== prevValue) {").indent()
    writer.writeLine(`const prevNode = ${nodeGetterId}(prevValue)`)
    writer.writeLine(`const node = ${nodeGetterId}(key)`)
    writer.write("if (prevNode) {").indent()
    writeDomOperationCall(writer, "prevNode", info, "prev")
    writer.dedent().write("}").wrapLine()
    writer.write("if (node) {").indent()
    writeDomOperationCall(writer, "node", info, "next")
    writer.dedent().write("}").wrapLine()
    writer.write("prevValue = key")
    writer.dedent().write("}")
    writer.dedent().writeLine("}")
    writer.dedent().write("}")
    writer.write(")()")
}

export function hasSelectorForAttribute(
    selectorInfos: GeneratedSelectorInfo[],
    nodeContext: TemplateNodeContext,
    attribute: TemplateAttribute
) {
    return selectorInfos.some(item => {
        return item.targetNodeContext === nodeContext && item.targetAttribute === attribute
    })
}

export function hasSelectorForTextNode(
    selectorInfos: GeneratedSelectorInfo[],
    nodeContext: TemplateNodeContext
) {
    return selectorInfos.some(item => {
        return item.targetNodeContext === nodeContext && item.operation.method === "setText"
    })
}

function getSelectorOperation(nodeContext: TemplateNodeContext, attribute: TemplateAttribute) {
    const baseName = getAttributeBaseName(attribute.name.raw)
    if (baseName === "value" && nodeContext.node.tag === "select") {
        return
    }

    if (baseName === "class") {
        return {
            method: "setClassName" as const,
            staticClassAttr: nodeContext.attributesMap.class
        }
    }
    if (baseName.startsWith("xlink:")) {
        return {
            method: "setXlinkAttribute" as const,
            attrName: baseName.slice(6)
        }
    }
    return {
        method: "setAttribute" as const,
        attrName: baseName
    }
}

function validateSelectorExpression(
    expression: ParsedExpression,
    parsedForDirective: NonNullable<ReturnType<typeof getParsedDirective>>,
    parsedKeyExpression: ParsedExpression
):
    | {
          topLevelIdentifierName: string
          topLevelTransformedTo: string
      }
    | undefined {
    const topLevelIdentifierNames = Object.keys(expression.topLevelReferences)
    if (topLevelIdentifierNames.length !== 1) {
        return
    }

    const topLevelIdentifierName = topLevelIdentifierNames[0]
    const topLevelInfo = analyzeResult.script.topLevelIdentifiers[topLevelIdentifierName]
    if (!topLevelInfo?.transformTo) {
        return
    }

    if (!expression.contextReferences.length) {
        return
    }

    for (const reference of expression.contextReferences) {
        if (reference.pattern.directive !== parsedForDirective) {
            return
        }
    }

    const keyRanges: Range[] = []
    const keyNode = getStriptTypeOperationsNode(parsedKeyExpression.node)
    walkTsNode(expression.node, node => {
        if (isExpressionEqual(node, keyNode)) {
            keyRanges.push([node.getStart(), node.getEnd()])
        }
    })
    if (!keyRanges.length) {
        return
    }

    const normalizedKeyRanges = normalizeRanges(keyRanges)
    for (const reference of expression.contextReferences) {
        if (!isRangeCovered(reference.range, normalizedKeyRanges)) {
            return
        }
    }

    let valid = true
    walkTsNode(expression.node, node => {
        if (!valid || !ts.isIdentifier(node) || !isBindingReference(node)) {
            return
        }

        const range: Range = [node.getStart(), node.getEnd()]
        const isTopLevelIdentifier =
            node.text === topLevelIdentifierName &&
            expression.topLevelReferences[topLevelIdentifierName].some(item => {
                return item.range[0] === range[0] && item.range[1] === range[1]
            })
        if (isTopLevelIdentifier) {
            return
        }

        if (isRangeCovered(range, normalizedKeyRanges)) {
            return
        }
        valid = false
    })

    if (!valid) {
        return
    }
    return {
        topLevelIdentifierName,
        topLevelTransformedTo: topLevelInfo.transformTo
    }
}

function writeDomOperationCall(
    writer: RuntimeCodeWriter,
    nodeId: string,
    info: GeneratedSelectorInfo,
    expressionType: "prev" | "next"
) {
    const sourceIndex = info.targetAttribute
        ? info.targetAttribute.equalSign
            ? info.targetAttribute.value.loc.start.index
            : info.targetAttribute.loc.start.index
        : info.targetTextPart?.loc.start.index
    const internalId = generateIdentifier.internal

    switch (info.operation.method) {
        case "setClassName": {
            writer.write(`${internalId}.`).write("setClassName", sourceIndex).write(`(${nodeId}, `)

            if (info.operation.staticClassAttr) {
                writer.write("[")
                writer.writeTemplateStr(
                    getMaybeReusedString(info.operation.staticClassAttr.value.raw),
                    info.operation.staticClassAttr.value.loc
                )
                writer.write(", ")
                writeSelectorExpression(writer, info, expressionType)
                writer.write("]")
            } else {
                writeSelectorExpression(writer, info, expressionType)
            }
            writer.write(")")
            break
        }

        case "setAttribute": {
            writer.write(`${internalId}.`).write("setAttribute", sourceIndex)
            writer.write(`(${nodeId}, `).write(`${getMaybeReusedString(info.operation.attrName)}, `)
            writeSelectorExpression(writer, info, expressionType)
            writer.write(")")
            break
        }

        case "setXlinkAttribute": {
            writer.write(`${internalId}.`).write("setXlinkAttribute", sourceIndex)
            writer.write(`(${nodeId}, `).write(`${getMaybeReusedString(info.operation.attrName)}, `)
            writeSelectorExpression(writer, info, expressionType)
            writer.write(")")
            break
        }

        case "setText": {
            writer.write(`${internalId}.`).write("setText", sourceIndex).write(`(${nodeId}, `)
            writeSelectorExpression(writer, info, expressionType)
            writer.write(")")
            break
        }
    }
}

function writeSelectorExpression(
    writer: RuntimeCodeWriter,
    info: GeneratedSelectorInfo,
    expressionType: "prev" | "next"
) {
    const parsedExpression = getParsedExpression(info.expressionKey)!
    const parsedKeyExpression = getParsedExpression(info.keyDirective)!
    const editor = new CodeEditor(parsedExpression.source, parsedExpression.startSourceIndex)

    const topLevelReplacement = expressionType === "prev" ? "prevValue" : info.topLevelTransformedTo
    for (const reference of parsedExpression.topLevelReferences[info.topLevelIdentifierName] ??
        []) {
        if (reference.shorthand) {
            editor.insert(reference.range[1], `: ${topLevelReplacement}`)
        } else {
            editor.replace(reference.range[0], reference.range[1], topLevelReplacement, true)
        }
    }

    const keyRanges: Range[] = []
    const keyNode = getStriptTypeOperationsNode(parsedKeyExpression.node)
    walkTsNode(parsedExpression.node, node => {
        if (isExpressionEqual(node, keyNode)) {
            keyRanges.push([node.getStart(), node.getEnd()])
        }
    })
    for (const [start, end] of normalizeRanges(keyRanges).toSorted((a, b) => b[0] - a[0])) {
        editor.replace(start, end, "key", true)
    }
    writer.writeEditedScript(editor)
}

function walk(node: TemplateNode, callback: (node: TemplateNode) => void) {
    callback(node)
    for (const child of node.children) {
        walk(child, callback)
    }
}

function isRangeCovered(range: Range, ranges: Range[]) {
    return ranges.some(item => {
        return item[0] <= range[0] && item[1] >= range[1]
    })
}

function normalizeRanges(ranges: Range[]) {
    const sorted = ranges
        .map(item => [item[0], item[1]] as Range)
        .toSorted((a, b) => a[0] - b[0] || b[1] - a[1])
    const ret: Range[] = []
    for (const current of sorted) {
        const prev = ret[ret.length - 1]
        if (!prev) {
            ret.push(current)
            continue
        }
        if (current[0] >= prev[0] && current[1] <= prev[1]) {
            continue
        }
        ret.push(current)
    }
    return ret
}
