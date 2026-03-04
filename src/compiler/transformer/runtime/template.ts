import type {
    TemplateNode,
    TemplateAttribute,
    TemplateNodeContext
} from "#type-declarations/compiler"
import type { CodeWriter } from "../writer"
import type { StringLiteral } from "@babel/types"
import type { GeneralFunc } from "#type-declarations/tools"

import {
    getParsedPatterns,
    getParsedEventInfo,
    getParsedExpression,
    getPrevElementContext,
    getNextElementContent,
    getTemplateNodeContext
} from "../../../util/compiler/template"
import {
    getAttributeBaseName,
    getMaybeReusedString,
    ensureIdWithNumSuffix,
    shouldExtractCommonString
} from "../../../util/compiler/sundry"
import { jsValidIdentifierRE } from "../../regular"
import { DELEGATABLE_EVENTS, SPREAD_TAG } from "../../constants"
import { generateFramgmentSelection } from "./fragment"
import { getLastElem } from "../../../util/shared/arrays"
import { stripTypeExpressions } from "../../estree/sundry"
import { analyzeResult, inputDescriptor } from "../../state"
import { isFunctionLiteral, isInlineEventHandler } from "../../estree/assert"

export function generateTemplateRender(
    nodes: TemplateNode[],
    writer: CodeWriter,
    by: "directive" | "component" | "slot" | "" = ""
) {
    let attachmentNodeContext: TemplateNodeContext | undefined
    for (const node of nodes) {
        const nodeContext = getTemplateNodeContext(node)
        if (
            nodeContext.sortedDirectives.some(item => {
                return item.name.raw !== "#slot"
            })
        ) {
            generateDirectiveBlock(nodeContext, 0, writer)
        } else if ("slot" === node.tag && by !== "slot") {
            generateSlotCall(nodeContext, writer)
        } else if (node.componentTag) {
            generateComponentInstantiate(node, writer)
        } else if (nodeContext.fragment?.content.length) {
            attachmentNodeContext = nodeContext
            generateFramgmentSelection(nodeContext.fragment, writer)
        }
    }
    if (by !== "directive") {
        generateRenderEffect(nodes, writer, !!by)
    }
    if (attachmentNodeContext) {
        generateFragmentAttachment(attachmentNodeContext, writer)
    }
}

function generateDirectiveBlock(
    nodeContext: TemplateNodeContext,
    directiveIndex: number,
    writer: CodeWriter
) {
    const node = nodeContext.node
    const internalId = analyzeResult.generateIds.internal
    const getterArg = analyzeResult.generateIds.getterArg
    const directive = nodeContext.sortedDirectives[directiveIndex]

    switch (directive?.name.raw) {
        case "#show": {
            writer.wrapLine().write(`${internalId}.displayBlock(`).indent()
            writer.write(`${getterArg} => (`).writeParsedExpression(directive).writeLine("),")
            generateDirectiveRender({
                enclosure() {
                    writer.dedent().write(")")
                }
            })
            break
        }

        case "#html": {
            writer.wrapLine().write(`${internalId}.htmlBlock(`).indent()
            writer.write(nodeContext.anchorId).writeLine(",").write(`${getterArg} => (`)
            writer.writeInterpolatedText(node.children[0]).write(")")

            if (directive.equalSign) {
                writer.writeLine(",").write(`${getterArg} => (`)
                writer.writeParsedExpression(writer).write(")")
            }
            writer.dedent().writeLine(")")
            break
        }

        case "#target": {
            writer.wrapLine().write(`${internalId}.targetBlock(`).indent()
            writer.write(nodeContext.anchorId).writeLine(",").write(`${getterArg} => (`)
            writer.writeParsedExpression(directive).writeLine("),")
            generateDirectiveRender({
                enclosure() {
                    writer.dedent().write(")")
                }
            })
            break
        }

        case "#if": {
            writer.wrapLine().write(`${internalId}.conditionBlock([`).indent()
            // fallthrough
        }
        case "#elif": {
            writer.write(`${getterArg} => (`)
            writer.writeParsedExpression(directive).write("),").wrapLine()
            // fallthrough
        }
        case "#else": {
            generateDirectiveRender({
                enclosure() {
                    if (doesDirectiveHasContinuousItem(nodeContext.node, directive)) {
                        writer.writeLine(",")
                    } else {
                        writer.dedent().write("])")
                    }
                }
            })

            break
        }

        case "#await": {
            const noRender = !!(
                nodeContext.attributesMap["#then"] || nodeContext.attributesMap["#catch"]
            )
            writer.wrapLine().write(`${internalId}.promiseBlock(`).indent()
            writer.write(`${getterArg} => (`).writeParsedExpression(directive).writeLine("),")

            if (noRender) {
                generateDirectiveEmptyRender()
                break
            }
            // fallthrough
        }
        case "#then": {
            if (!nodeContext.fragment?.content.length) {
                generateDirectiveEmptyRender()
                break
            }
            // fallthrough
        }
        case "#catch": {
            if (directive.name.raw === "#catch") {
                let withoutThenDirective = !!nodeContext.attributesMap["#await"]
                if (!withoutThenDirective) {
                    const prevElementContext = getPrevElementContext(node)!
                    if (prevElementContext.sortedDirectives[0].name.raw === "#await") {
                        withoutThenDirective =
                            prevElementContext.sortedDirectives[1]?.name.raw !== "#then"
                    } else {
                        withoutThenDirective =
                            prevElementContext.sortedDirectives[0].name.raw !== "#then"
                    }
                }
                if (withoutThenDirective) {
                    writer.writeLine(`${internalId}.NIL,`)
                }
            }
            generateDirectiveRender({
                enclosure() {
                    if (doesDirectiveHasContinuousItem(node, directive)) {
                        writer.writeLine(",")
                    } else {
                        writer.dedent().write(")")
                    }
                }
            })
            break
        }

        case "#for": {
            const keyDirective = nodeContext.attributesMap["#key"]

            const generateContextDeclaration = () => {
                const patterns = getParsedPatterns(directive)
                if (patterns) {
                    for (let i = 0; i < patterns.length; i++) {
                        if (!patterns[i]) {
                            continue
                        }

                        const pattern = patterns[i]!
                        const contextGetterArg = i ? "0" : ""
                        const valueStartSourceIndex = directive.value.loc.start.index
                        const contextGetterId = analyzeResult.generateIds.contextGetter
                        const pureMarker = pattern.type === "Identifier" ? "/*#__PURE__*/" : ""
                        writer.write(`const `).writeContextPattern(pattern, valueStartSourceIndex)
                        writer.writeLine(` = ${pureMarker}${contextGetterId}(${contextGetterArg})`)
                    }
                }
            }

            if ((writer.wrapLine().write(`${internalId}.listBlock(`).indent(), keyDirective)) {
                writer.write(nodeContext.anchorId).write(",").wrapLine()
                nodeContext.anchorId = ensureIdWithNumSuffix("anchor")
            }
            writer.write(`${getterArg} => (`)
            writer.writeParsedExpression(directive).write("),").wrapLine()

            if (keyDirective) {
                writer.write(`${getterArg} => {`).indent()
                generateContextDeclaration()
                writer.write("return (")
                writer.writeParsedExpression(keyDirective)
                writer.write(")").dedent().write("},").wrapLine()
            }
            generateDirectiveRender({
                context() {
                    generateContextDeclaration()
                },
                enclosure() {
                    writer.dedent().write(")")
                },
                arg() {
                    if (keyDirective) {
                        writer.write(
                            `(${nodeContext.anchorId}, ${analyzeResult.generateIds.contextGetter})`
                        )
                    } else {
                        writer.write(analyzeResult.generateIds.contextGetter)
                    }
                }
            })
            break
        }
    }

    function generateDirectiveRender(insert?: {
        arg?: GeneralFunc
        context?: GeneralFunc
        enclosure?: GeneralFunc
    }) {
        if (insert?.arg) {
            insert.arg()
        } else {
            writer.write(getterArg)
        }
        if (
            (writer.write(" => {").indent(false), isLastDirectiveIndex(nodeContext, directiveIndex))
        ) {
            if (node.componentTag) {
                generateComponentInstantiate(node, writer)
            } else {
                if ((insert?.context?.(), nodeContext.fragment)) {
                    generateFramgmentSelection(nodeContext.fragment, writer)
                }
                generateRenderEffect([node], writer, true)
                generateTemplateRender(node.children, writer, "directive")
                nodeContext.fragment && generateFragmentAttachment(nodeContext, writer)
            }
        }
        generateDirectiveBlock(nodeContext, directiveIndex + 1, writer)
        writer.dedent().write("}")
        insert?.enclosure?.()
    }

    function generateDirectiveEmptyRender() {
        writer.writeLine(`${internalId}.UNDEF,`)
        generateDirectiveBlock(nodeContext, directiveIndex + 1, writer)
    }
}

function generateRenderEffect(
    nodes: TemplateNode[],
    writer: CodeWriter,
    skipAnchorCheck = false,
    withinRenderEffect = false
) {
    let createdRenderEffect = false
    const internalId = analyzeResult.generateIds.internal
    const getterArgId = analyzeResult.generateIds.getterArg
    const setterArgId = analyzeResult.generateIds.setterArg

    const generateRenderEffectCall = () => {
        if (!withinRenderEffect && !createdRenderEffect) {
            createdRenderEffect = true
            writer.wrapLine().write(`${internalId}.renderEffect(() => {`).indent(false)
        }
        return writer
    }

    for (const node of nodes) {
        const nodeContext = getTemplateNodeContext(node)
        if (!skipAnchorCheck && nodeContext.anchorId) {
            continue
        }
        if (node.componentTag || "slot" === node.tag || SPREAD_TAG === node.tag) {
            generateRenderEffect(node.children, writer, false, withinRenderEffect)
            continue
        }

        // event handlers
        for (const event of nodeContext.eventListeners) {
            const eventInfo = getParsedEventInfo(event)!
            const expression = getParsedExpression(event)!
            const baseName = eventInfo.eventName.slice(1)
            const wrapperFlag = eventInfo.flagInfo.wrapper
            const generalFlag = eventInfo.flagInfo.general
            const delegated = DELEGATABLE_EVENTS.has(baseName)
            const tipComment = inputDescriptor.options.tipComment
            const stringifiedBaseName = getMaybeReusedString(baseName)
            const stripTypeExpressionNode = stripTypeExpressions(expression.node)
            writer.write(`${internalId}.${delegated ? "delegate" : "listen"}(`)
            writer.write(`${nodeContext.id}, `).write(stringifiedBaseName).write(", ")

            if (wrapperFlag.value) {
                writer.write(`${internalId}.createEventWrapper(`)
            }
            if (isFunctionLiteral(stripTypeExpressionNode)) {
                writer.writeParsedExpression(event)
            } else if (!isInlineEventHandler(stripTypeExpressionNode)) {
                writer.write(`function ($arg){`).indent()
                writer.write(`${internalId}.call(`)
                writer.writeParsedExpression(event)
                writer.write(`, this, $arg)`)
                writer.dedent().write("}")
            } else {
                writer.write(`$arg => {`).indent()
                writer.writeParsedExpression(event)
                writer.dedent().write("}")
            }
            if (wrapperFlag.value) {
                if ((writer.write(", "), tipComment)) {
                    writer.write(`/* ${wrapperFlag.names.join(" | ")} */ `)
                }
                writer.write(wrapperFlag.value.toString()).write(")")
            }
            if (generalFlag.value) {
                if ((writer.write(", "), tipComment)) {
                    writer.write(`/* ${generalFlag.names.join("| ")} */ `)
                }
                writer.write(generalFlag.value.toString())
            }
            writer.writeLine(")")
        }

        // refernec attributes
        for (const attribute of nodeContext.referenceAttributes) {
            const generateBindCall = (method: string, type: "getter" | "setter") => {
                writer.write(`${internalId}.${method}(${nodeContext.id}, `)

                if (type === "getter") {
                    writer.write(`${getterArgId} => (`)
                    writer.writeParsedExpression(attribute).writeLine(")")
                } else {
                    writer.write(`${setterArgId} => (`).writeParsedExpression(attribute)
                    writer.write(` = ${setterArgId}`).writeLine(")")
                }
            }

            switch (attribute.name.raw) {
                case "&group": {
                    generateBindCall("bindInputGroup", "getter")
                }
                case "&dom": {
                    generateBindCall("bindDomReceiver", "setter")
                    break
                }
                case "&number": {
                    generateBindCall("bindInputNumber", "setter")
                    break
                }
                case "&checked": {
                    generateBindCall("bindInputChecked", "setter")
                    break
                }
                case "&value": {
                    if (node.tag === "input") {
                        generateBindCall("bindInputValue", "setter")
                    } else {
                        generateBindCall("bindSelectValue", "getter")
                    }
                    break
                }
            }
        }

        // dynamic attributes
        const dynamicAttrsWithEffect: TemplateAttribute[] = []
        const dynamicAttrsWithoutEffect: TemplateAttribute[] = []
        for (const attribute of nodeContext.dynamicAttributes) {
            if (doesAttributeHasRenderEffect(attribute)) {
                dynamicAttrsWithEffect.push(attribute)
            } else {
                dynamicAttrsWithoutEffect.push(attribute)
            }
        }
        for (const attribute of dynamicAttrsWithoutEffect) {
            const baseName = getAttributeBaseName(attribute.name.raw)
            writer.wrapLine().write(`${internalId}.setAttribute(`)
            writer.write(`${nodeContext.id}, `)
            writer.write(`${getMaybeReusedString(baseName)}, `)
            writer.writeParsedExpression(attribute).write(")")
        }
        for (const attribute of dynamicAttrsWithEffect) {
            const baseName = getAttributeBaseName(attribute.name.raw)
            generateRenderEffectCall().wrapLine()
            writer.write(`${internalId}.setAttribute(`)
            writer.write(`${nodeContext.id}, `)
            writer.write(`${getMaybeReusedString(baseName)}, `)
            writer.writeParsedExpression(attribute).write(")")
        }

        if (node.content.some(part => part.isInterpolated)) {
            generateRenderEffectCall().wrapLine()
            writer.write(`${internalId}.setText(`)
            writer.write(`${nodeContext.id}, `)
            writer.writeInterpolatedText(node).write(")")
        }
        generateRenderEffect(node.children, writer, false, withinRenderEffect)
    }
    createdRenderEffect && writer.dedent().write("})")
}

function generateSlotCall(nodeContext: TemplateNodeContext, writer: CodeWriter) {
    let needInsertComma = false

    const contextId = analyzeResult.generateIds.context
    const hasDefaultContent = !!nodeContext.fragment?.content.length

    const insertTrailingComma = () => {
        if (needInsertComma) {
            writer.writeLine(",")
        }
        return ((needInsertComma = true), writer)
    }

    const generateSlotName = () => {
        const slotName = nodeContext.attributesMap["name"]?.value.raw ?? "default"
        return generateContextKey(slotName, writer)
    }
    if (!hasDefaultContent) {
        writer.wrapLine().write(`${contextId}.s?.`)
        generateSlotName().write(`(${nodeContext.anchorId}`)
    } else {
        writer.wrapLine().write(`;(${contextId}.s?.`)
        generateSlotName().write(" ?? () => {").indent(false)
        generateTemplateRender([nodeContext.node], writer, "slot")
        writer.dedent().write(`})(${nodeContext.anchorId}`)
    }

    if (nodeContext.staticAttributes.length || nodeContext.dynamicAttributes.length) {
        writer.write(", {").indent()

        for (const attribute of nodeContext.dynamicAttributes) {
            const baseName = getAttributeBaseName(attribute.name.raw)
            insertTrailingComma()
            generateContextKey(baseName, writer, {
                after(computed) {
                    if (!computed && !attribute.equalSign) {
                        return
                    }
                    writer.write(": ").writeParsedExpression(attribute)
                }
            })
        }
        for (const attribute of nodeContext.staticAttributes) {
            const rawName = attribute.name.raw
            if (rawName === "name") {
                continue
            }
            insertTrailingComma()
            generateContextKey(attribute.name.raw, writer).write(": ")
            writer.write(attribute.equalSign ? getMaybeReusedString(attribute.value.raw) : "true")
        }
        writer.dedent().write("}")
    }
    writer.write(")")
}

function generateComponentInstantiate(node: TemplateNode, writer: CodeWriter) {
    let needInsertComma = false

    const nodeContext = getTemplateNodeContext(node)
    const getterArgId = analyzeResult.generateIds.getterArg
    const setterArgId = analyzeResult.generateIds.setterArg
    const hasRefs = !!nodeContext.referenceAttributes.length
    const hasStaticAttrs = !!nodeContext.staticAttributes.length
    const hasEventListeners = !!nodeContext.eventListeners.length
    const hasDynamicAttrs = !!nodeContext.dynamicAttributes.length
    const hasSlots = node.children.some(child => {
        return getTemplateNodeContext(child).fragment!.content.length
    })
    const hasProps = hasStaticAttrs || hasEventListeners || hasDynamicAttrs

    const insertTrailingComma = () => {
        if (needInsertComma) {
            writer.writeLine(",")
        }
        return ((needInsertComma = true), writer)
    }

    if ((writer.wrapLine().writeParsedExpression(node), !(hasSlots || hasProps || hasRefs))) {
        return (writer.write(`(${nodeContext.anchorId})`), undefined)
    }

    if ((writer.write(`(${nodeContext.anchorId}, {`).indent(), hasProps)) {
        writer.write("p: {").indent()

        for (const attribute of nodeContext.staticAttributes) {
            const baseName = getAttributeBaseName(attribute.name.raw)
            insertTrailingComma()
            generateContextKey(baseName, writer).write(": ")

            if (!attribute.equalSign) {
                writer.write("true")
            } else {
                writer.writeTemplateStr(
                    getMaybeReusedString(attribute.value.raw),
                    attribute.value.loc
                )
            }
        }
        for (const event of nodeContext.eventListeners) {
            const expression = getParsedExpression(event)!
            const baseName = getParsedEventInfo(event)!.eventName.slice(1)
            insertTrailingComma()
            generateContextKey(baseName, writer)
            writer.write(": ").write(`${getterArgId} => (`)

            if (isInlineEventHandler(expression.node)) {
                writer.write(`$arg => {`).indent()
                writer.writeParsedExpression(event)
                writer.dedent().write("}")
            } else {
                writer.writeParsedExpression(event)
            }
            writer.write(")")
        }
        for (const attribute of nodeContext.dynamicAttributes) {
            const baseName = getAttributeBaseName(attribute.name.raw)
            insertTrailingComma()
            generateContextKey(baseName, writer).write(": ")
            writer.write(`${getterArgId} => (`).writeParsedExpression(attribute).write(")")
        }

        writer.dedent().write("}")
    }

    if (hasRefs) {
        insertTrailingComma().write("r: {").indent()

        for (const attribute of nodeContext.referenceAttributes) {
            if (attribute !== nodeContext.referenceAttributes[0]) {
                insertTrailingComma()
            }
            generateContextKey(getAttributeBaseName(attribute.name.raw), writer)
            writer.write(": [").indent().write(`${getterArgId} => (`)
            writer.write(getParsedExpression(attribute)!.source).writeLine("),")
            writer.write(`${setterArgId} => (`).writeParsedExpression(attribute)
            writer.write(` = ${setterArgId})`).dedent().write("]")
        }
        writer.dedent().write("}")
    }

    if (hasSlots) {
        insertTrailingComma().write("s: {").indent()
        needInsertComma = false

        for (const child of node.children) {
            const childContext = getTemplateNodeContext(child)
            if (!childContext.fragment!.content.length) {
                continue
            }

            const anchorId = (childContext.anchorId = ensureIdWithNumSuffix("anchor"))
            const slotDirective = childContext.attributesMap["#slot"]
            const expression = slotDirective && getParsedExpression(slotDirective)
            const pattern = slotDirective && getParsedPatterns(slotDirective)?.[0]
            const slotName = expression ? (expression.node as StringLiteral).value : "default"
            insertTrailingComma()
            generateContextKey(slotName, writer).write(`(${anchorId}`)

            if (pattern) {
                const startSourceIndex = slotDirective.value.loc.start.index
                writer.write(", ").writeContextPattern(pattern, startSourceIndex)
            }
            writer.write(") {").indent(false)
            generateTemplateRender([child], writer, "component")
            writer.dedent().write("}")
        }
        writer.dedent().write("}")
    }

    writer.dedent().write("})")
}

function isLastDirectiveIndex(nodeContext: TemplateNodeContext, index: number) {
    const directive = nodeContext.sortedDirectives[index]
    const directiveName = directive.name.raw
    if (index === nodeContext.sortedDirectives.length - 1) {
        return true
    }
    return (
        directiveName === "#for" &&
        index === nodeContext.sortedDirectives.length - 2 &&
        getLastElem(nodeContext.sortedDirectives)!.name.raw === "#key"
    )
}

function doesDirectiveHasContinuousItem(node: TemplateNode, directive: TemplateAttribute) {
    const expectedContinuousDirective: string[] = []
    switch (directive.name.raw) {
        case "#if":
        case "#elif": {
            expectedContinuousDirective.push("#elif", "#else")
            break
        }
        case "#then":
        case "#await":
        case "#catch": {
            expectedContinuousDirective.push("#then", "#catch")
            break
        }
        default: {
            return false
        }
    }

    const nextElementContext = getNextElementContent(node)
    if (nextElementContext) {
        return expectedContinuousDirective.includes(
            nextElementContext.sortedDirectives[0]?.name.raw
        )
    }
    return false
}

function doesAttributeHasRenderEffect(attribute: TemplateAttribute) {
    return getParsedExpression(attribute)!.reactive
}

function generateFragmentAttachment(nodeContext: TemplateNodeContext, writer: CodeWriter) {
    const fragmentId = nodeContext.fragment!.id
    const internalId = analyzeResult.generateIds.internal
    const anchorId = nodeContext.anchorId || analyzeResult.generateIds.anchor
    writer.wrapLine().write(`${internalId}.insertBefore(${anchorId}, ${fragmentId})`)
}

function generateContextKey(
    str: string,
    writer: CodeWriter,
    insert?: {
        after?: (computed: boolean) => void
        before?: (computed: boolean) => void
    }
) {
    if (jsValidIdentifierRE.test(str) && (str.length < 3 || !shouldExtractCommonString(str))) {
        return (insert?.before?.(false), writer.write(str), insert?.after?.(false), writer)
    }

    // prettier-ignore
    return (insert?.before?.(true), writer.write(`[${getMaybeReusedString(str)}]`), insert?.after?.(true), writer)
}
