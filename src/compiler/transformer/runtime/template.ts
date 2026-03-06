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
import { isNull } from "../../../util/shared/assert"
import { DELEGATABLE_EVENTS } from "../../constants"
import { generateFramgmentSelection } from "./fragment"
import { getLastElem } from "../../../util/shared/arrays"
import { stripTypeExpressions } from "../../estree/sundry"
import { isHtmlDirectiveChild } from "../../../util/compiler/assert"
import { isFunctionLiteral, isInlineEventHandler } from "../../estree/assert"
import { analyzeResult, generateIdentifier, inputDescriptor } from "../../state"

export function generateTemplateRender(nodes: TemplateNode[], writer: CodeWriter) {
    let insertPostfix: GeneralFunc | undefined

    const isTopLevelNodes = nodes[0] && isNull(nodes[0].parent)
    const componentFragment = analyzeResult.template.componentFragment

    const wrapInsertPostfix = (method: GeneralFunc | undefined) => {
        if (method) {
            const original = insertPostfix
            insertPostfix = () => {
                method()
                original?.()
                insertPostfix = undefined
            }
        }
    }

    if (isTopLevelNodes && componentFragment?.content.length) {
        generateFramgmentSelection(componentFragment, writer)
        generateRenderEffect(writer, nodes, null)
    }

    for (const node of nodes) {
        const nodeContext = getTemplateNodeContext(node)
        const hasFragmentContent = !!nodeContext.fragment?.content.length
        if (
            nodeContext.sortedDirectives.some(item => {
                return item.name.raw !== "#slot"
            })
        ) {
            wrapInsertPostfix(generateDirectiveBlock(writer, 0, nodeContext))
        }
        if (node.componentTag) {
            generateComponentInstantiate(writer, nodeContext)
            continue
        }
        if ("slot" === node.tag) {
            wrapInsertPostfix(generateSlotCall(writer, nodeContext) as any)
        }
        if (hasFragmentContent) {
            generateFramgmentSelection(nodeContext.fragment!, writer)
            generateRenderEffect(writer, [node], node)
        }

        /**
         * 当节点上除了 #html 指令还存在其他指令时，{@link generateDirectiveBlock}
         * 方法不会生成指令块调用语句，因为此情况下调用语句必须等待其他节点（锚点）选择完成后才能生成
         *
         * When a node has other directives besides the #html directive, the {@link generateDirectiveBlock}
         * method will not generate the directive block call statement, because in this case the call statement
         * must wait until other nodes (anchor) are selected before it can be generated
         */
        if (nodeContext.attributesMap["#html"] && nodeContext.sortedDirectives.length !== 1) {
            const htmlDirectiveIndex = nodeContext.sortedDirectives.findIndex(item => {
                return item.name.raw === "#html"
            })
            generateDirectiveBlock(writer, htmlDirectiveIndex, nodeContext)
        }

        if ((generateTemplateRender(node.children, writer), hasFragmentContent)) {
            wrapInsertPostfix(() => {
                generateFragmentAttachment(writer, nodeContext.anchorId, nodeContext.fragment!.id)
            })
        }
    }
    if ((insertPostfix?.(), isTopLevelNodes)) {
        generateFragmentAttachment(writer, generateIdentifier.anchor, componentFragment!.id)
    }
}

function generateDirectiveBlock(
    writer: CodeWriter,
    directiveIndex: number,
    nodeContext: TemplateNodeContext
): GeneralFunc | undefined {
    const node = nodeContext.node
    const internalId = generateIdentifier.internal
    const getterArg = generateIdentifier.getterArg
    const directive = nodeContext.sortedDirectives[directiveIndex]

    // 跳过 #html 指令的处理，推迟至节点选择完成后生成
    // Skip processing the `#html` directive; generate it after node selection is completed
    const generateNextDirective = () => {
        const delta = nodeContext.sortedDirectives[directiveIndex + 1]?.name.raw === "#html" ? 2 : 1
        return generateDirectiveBlock(writer, directiveIndex + delta, nodeContext)
    }

    switch (directive?.name.raw) {
        case "#html": {
            writer.wrapLine().write(`${internalId}.htmlBlock(`).indent()
            writer.write(getTemplateNodeContext(nodeContext.node.children[0]).id)
            writer.writeLine(",").write(`${getterArg} => (`)
            writer.writeInterpolatedText(node.children[0]).write(")")

            if (directive.equalSign) {
                writer.writeLine(",").write(`${getterArg} => (`)
                writer.writeParsedExpression(writer).write(")")
            }
            return (writer.dedent().write(")"), undefined)
        }

        case "#target": {
            writer.wrapLine().write(`${internalId}.targetBlock(`).indent()
            writer.write(nodeContext.anchorId).writeLine(",").write(`${getterArg} => (`)
            writer.writeParsedExpression(directive).writeLine("),")
            return generateDirectiveRender({
                enclosure() {
                    writer.dedent().write(")")
                }
            })
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
            return generateDirectiveRender({
                enclosure() {
                    if (doesDirectiveHasContinuousItem(nodeContext.node, directive)) {
                        writer.writeLine(",")
                    } else {
                        writer.dedent().write("])")
                    }
                }
            })
        }

        case "#await": {
            const noRender = !!(
                nodeContext.attributesMap["#then"] || nodeContext.attributesMap["#catch"]
            )
            writer.wrapLine().write(`${internalId}.promiseBlock(`).indent()
            writer.write(`${getterArg} => (`).writeParsedExpression(directive).writeLine("),")

            if (noRender) {
                return (writer.writeLine(`${internalId}.UNDEF,`), generateNextDirective())
            }
            // fallthrough
        }
        case "#then": {
            if (!nodeContext.fragment?.content.length) {
                return (writer.writeLine(`${internalId}.UNDEF,`), undefined)
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
            return generateDirectiveRender({
                enclosure() {
                    if (doesDirectiveHasContinuousItem(node, directive)) {
                        writer.writeLine(",")
                    } else {
                        writer.dedent().write(")")
                    }
                }
            })
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
                        const contextGetterId = generateIdentifier.contextGetter
                        const valueStartSourceIndex = directive.value.loc.start.index
                        const pureMarker = pattern.type === "Identifier" ? "/*#__PURE__*/" : ""
                        writer.write(`const `).writeContextPattern(pattern, valueStartSourceIndex)
                        writer.writeLine(` = ${pureMarker}${contextGetterId}(${contextGetterArg})`)
                    }
                }
            }

            if ((writer.wrapLine().write(`${internalId}.listBlock(`).indent(), keyDirective)) {
                writer.write(nodeContext.anchorId).write(",").wrapLine()
                nodeContext.anchorId = ensureIdWithNumSuffix("_anchor")
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
            return generateDirectiveRender({
                context() {
                    generateContextDeclaration()
                },
                enclosure() {
                    writer.dedent().write(")")
                },
                arg() {
                    if (keyDirective) {
                        writer.write(
                            `(${nodeContext.anchorId}, ${generateIdentifier.contextGetter})`
                        )
                    } else {
                        writer.write(generateIdentifier.contextGetter)
                    }
                }
            })
        }
    }

    function generateDirectiveRender(insert?: {
        arg?: GeneralFunc
        context?: GeneralFunc
        enclosure?: GeneralFunc
    }): GeneralFunc {
        if (insert?.arg) {
            insert.arg()
        } else {
            writer.write(getterArg)
        }
        writer.write(" => {").indent(false)

        const childEnclosure = generateNextDirective()
        return () => (childEnclosure?.(), writer.dedent().write("}"), insert?.enclosure?.())
    }
}

function generateRenderEffect(
    writer: CodeWriter,
    nodes: TemplateNode[],
    skipCheckNode: TemplateNode | null
) {
    let withinRenderEffect = false
    const internalId = generateIdentifier.internal
    const getterArgId = generateIdentifier.getterArg
    const setterArgId = generateIdentifier.setterArg

    const generateRenderEffectCall = () => {
        if (!withinRenderEffect) {
            withinRenderEffect = true
            writer.wrapLine().write(`${internalId}.renderEffect(() => {`).indent(false)
        }
        return writer
    }

    ;(function generate(nodes: TemplateNode[]) {
        for (const node of nodes) {
            const nodeContext = getTemplateNodeContext(node)
            if (nodeContext.fragment && skipCheckNode !== node) {
                continue
            }
            if (node.componentTag || "slot" === node.tag) {
                generate(node.children)
                continue
            }

            const generateSetAttributeCall = (
                attribute: TemplateAttribute,
                renderEffect = false
            ) => {
                const baseName = getAttributeBaseName(attribute.name.raw)
                if ((renderEffect && generateRenderEffectCall(), baseName === "class")) {
                    const staticClassAttr = nodeContext.attributesMap["class"]
                    if ((writer.wrapLine().write(`${internalId}.setClassName(`), staticClassAttr)) {
                        writer.write("[")
                        writer.writeTemplateStr(
                            getMaybeReusedString(staticClassAttr.value.raw),
                            staticClassAttr.value.loc
                        )
                        writer.write(", ")
                    }
                    writer.writeParsedExpression(attribute)
                    writer.write(`${staticClassAttr ? "]" : ""})`)
                    return
                }
                if (baseName === "value" && node.tag === "select") {
                    writer.wrapLine().write(`${internalId}.`)
                    writer.write(`setSelectValue(${nodeContext.id}, `)
                    writer.writeParsedExpression(attribute).write(")")
                    return
                }

                const isXlinkAttr = baseName.startsWith("xlink:")
                const attrName = isXlinkAttr ? baseName.slice(6) : baseName
                const method = isXlinkAttr ? "setXlinkAttribute" : "setAttribute"
                writer.wrapLine().write(`${internalId}.${method}(${nodeContext.id}, `)
                writer.write(`${getMaybeReusedString(attrName)}, `)
                writer.writeParsedExpression(attribute).write(")")
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
                writer.wrapLine().write(`${internalId}.${delegated ? "delegate" : "listen"}(`)
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
                writer.write(")")
            }

            // refernec attributes
            for (const attribute of nodeContext.referenceAttributes) {
                const generateBindCall = (method: string, type: "getter" | "setter" | "both") => {
                    writer.wrapLine().write(`${internalId}.${method}(${nodeContext.id}, `)

                    if (type !== "setter") {
                        writer.write(`${getterArgId} => (`)
                        writer.writeParsedExpression(attribute).write(")")
                    }
                    if ((type === "both" && writer.write(", "), type !== "getter")) {
                        writer.write(`${setterArgId} => (`).writeParsedExpression(attribute)
                        writer.write(` = ${setterArgId}`).write(")")
                    }
                }

                switch (attribute.name.raw) {
                    case "&number": {
                        generateBindCall("bindInputNumber", "both")
                        break
                    }
                    case "&checked": {
                        generateBindCall("bindInputChecked", "both")
                        break
                    }
                    case "&group": {
                        generateBindCall("bindInputGroup", "getter")
                    }
                    case "&dom": {
                        generateBindCall("bindDomReceiver", "setter")
                        break
                    }
                    case "&value": {
                        if (node.tag === "input") {
                            generateBindCall("bindInputValue", "both")
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
                generateSetAttributeCall(attribute)
            }
            for (const attribute of dynamicAttrsWithEffect) {
                generateSetAttributeCall(attribute, true)
            }

            if (!isHtmlDirectiveChild(node) && node.content.some(part => part.isInterpolated)) {
                generateRenderEffectCall().wrapLine()
                writer.write(`${internalId}.setText(`)
                writer.write(`${nodeContext.id}, `)
                writer.writeInterpolatedText(node).write(")")
            }
            generate(node.children)
        }
    })(nodes)

    withinRenderEffect && writer.dedent().write("})")
}

function generateSlotCall(writer: CodeWriter, nodeContext: TemplateNodeContext) {
    let needInsertComma = false

    const contextId = generateIdentifier.context
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
    }
    return () => {
        if (hasDefaultContent) {
            writer.dedent().write(`})(${nodeContext.anchorId}`)
        }
        if (nodeContext.staticAttributes.length || nodeContext.dynamicAttributes.length) {
            writer.write(", {").indent()

            for (const attribute of nodeContext.dynamicAttributes) {
                const baseName = getAttributeBaseName(attribute.name.raw)
                insertTrailingComma()
                generateContextKey(baseName, writer)
                writer.write(": ").writeParsedExpression(attribute)
            }
            for (const attribute of nodeContext.staticAttributes) {
                const rawName = attribute.name.raw
                if (rawName === "name") {
                    continue
                }
                insertTrailingComma()
                generateContextKey(attribute.name.raw, writer).write(": ")
                writer.write(
                    attribute.equalSign ? getMaybeReusedString(attribute.value.raw) : "true"
                )
            }
            writer.dedent().write("}")
        }
        writer.write(")")
    }
}

function generateComponentInstantiate(writer: CodeWriter, nodeContext: TemplateNodeContext) {
    let needInsertComma = false

    const getterArgId = generateIdentifier.getterArg
    const setterArgId = generateIdentifier.setterArg
    const hasRefs = !!nodeContext.referenceAttributes.length
    const hasStaticAttrs = !!nodeContext.staticAttributes.length
    const hasEventListeners = !!nodeContext.eventListeners.length
    const hasDynamicAttrs = !!nodeContext.dynamicAttributes.length
    const hasSlots = nodeContext.node.children.some(child => {
        return getTemplateNodeContext(child).fragment!.content.length
    })
    const hasProps = hasStaticAttrs || hasEventListeners || hasDynamicAttrs

    const insertTrailingComma = () => {
        if (needInsertComma) {
            writer.writeLine(",")
        }
        return ((needInsertComma = true), writer)
    }

    writer.wrapLine().writeParsedExpression(nodeContext.node)

    if (!(hasSlots || hasProps || hasRefs)) {
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

    if (hasRefs && insertTrailingComma().write("r: {").indent()) {
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

        for (const child of nodeContext.node.children) {
            const childContext = getTemplateNodeContext(child)
            if (!childContext.fragment!.content.length) {
                continue
            }

            const anchorId = (childContext.anchorId = ensureIdWithNumSuffix("_anchor"))
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
            generateTemplateRender([child], writer)
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

function generateContextKey(str: string, writer: CodeWriter) {
    if (jsValidIdentifierRE.test(str) && (str.length < 3 || !shouldExtractCommonString(str))) {
        return writer.write(str)
    }
    return writer.write(`[${getMaybeReusedString(str)}]`)
}

function generateFragmentAttachment(writer: CodeWriter, anchorId: string, fragmentId: string) {
    writer.write(`\n${generateIdentifier.internal}.insertBefore(${anchorId}, ${fragmentId})`)
}
