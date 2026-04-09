import type {
    TemplateNode,
    ParsedExpression,
    TemplateAttribute,
    TemplateNodeContext,
    GeneratedSelectorInfo
} from "#type-declarations/compiler"
import type { RuntimeCodeWriter } from "../transformer/writer"

import {
    getParsedDirective,
    getParsedExpression,
    getTemplateNodeContext
} from "../../util/compiler/template"
import { walkEstree } from "../estree/walk"
import { getMaybeReusedString } from "./compress"
import { CodeEditor } from "../transformer/editor"
import { isExpressionEqual } from "../estree/assert"
import { stripTypeExpressions } from "../estree/sundry"
import { analyzeResult, generateIdentifier } from "../state"
import { getAttributeBaseName, ensureIdWithNumSuffix } from "../../util/compiler/sundry"

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

    const keyNode = stripTypeExpressions(parsedKeyExpression.node)
    if (
        keyNode.type !== "Identifier" &&
        keyNode.type !== "MemberExpression" &&
        keyNode.type !== "OptionalMemberExpression"
    ) {
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
    if (!topLevelInfo?.transofrmedTo) {
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

    const keyNode = stripTypeExpressions(parsedKeyExpression.node)
    const keyRanges: [number, number][] = []
    walkEstree(expression.node, {
        AnyNode(node) {
            if (!node.range) {
                return
            }
            if (isExpressionEqual(node as any, keyNode as any)) {
                keyRanges.push([node.range[0], node.range[1]])
            }
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
    walkEstree(expression.node, {
        Identifier(node, context) {
            if (!valid || !context.isBindingReference) {
                return
            }

            const range = node.range!
            const isTopLevelIdentifier =
                node.name === topLevelIdentifierName &&
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
        }
    })

    if (!valid) {
        return
    }
    return {
        topLevelIdentifierName,
        topLevelTransformedTo: topLevelInfo.transofrmedTo
    }
}

function writeDomOperationCall(
    writer: RuntimeCodeWriter,
    nodeId: string,
    info: GeneratedSelectorInfo,
    expressionType: "prev" | "next"
) {
    switch (info.operation.method) {
        case "setClassName": {
            writer.write(`${getInternalId()}.setClassName(${nodeId}, `)
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
            writer.write(`${getInternalId()}.setAttribute(${nodeId}, `)
            writer.write(`${getMaybeReusedString(info.operation.attrName)}, `)
            writeSelectorExpression(writer, info, expressionType)
            writer.write(")")
            break
        }

        case "setXlinkAttribute": {
            writer.write(`${getInternalId()}.setXlinkAttribute(${nodeId}, `)
            writer.write(`${getMaybeReusedString(info.operation.attrName)}, `)
            writeSelectorExpression(writer, info, expressionType)
            writer.write(")")
            break
        }

        case "setText": {
            writer.write(`${getInternalId()}.setText(${nodeId}, `)
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

    const keyNode = stripTypeExpressions(parsedKeyExpression.node)
    const keyRanges: [number, number][] = []
    walkEstree(parsedExpression.node, {
        AnyNode(node) {
            if (!node.range) {
                return
            }
            if (isExpressionEqual(node as any, keyNode as any)) {
                keyRanges.push([node.range[0], node.range[1]])
            }
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

function isRangeCovered(range: [number, number], ranges: [number, number][]) {
    return ranges.some(item => {
        return item[0] <= range[0] && item[1] >= range[1]
    })
}

function normalizeRanges(ranges: [number, number][]) {
    const sorted = ranges
        .map(item => [item[0], item[1]] as [number, number])
        .toSorted((a, b) => a[0] - b[0] || b[1] - a[1])
    const ret: [number, number][] = []
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

function getInternalId() {
    return generateIdentifier.internal
}
