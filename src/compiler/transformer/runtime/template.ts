import type {
    TemplateNode,
    TemplateAttribute,
    TemplateNodeContext
} from "#type-declarations/compiler"
import type { RuntimeCodeWriter } from "../writer"
import type { GeneralFunc } from "#type-declarations/tools"

import ts from "typescript"

import {
    isFunctionLiteral,
    isInlineEventHandler,
    isSimpleHandlerReference
} from "../../ts-ast/assert"
import {
    hasSelectorForAttribute,
    hasSelectorForTextNode,
    writeSelectorDeclaration,
    getForBlockSelectorInfos
} from "../../optimizer/selector"
import {
    getParsedEventInfo,
    getParsedDirective,
    getParsedExpression,
    getPrevElementContext,
    getNextElementContent,
    getTemplateNodeContext,
    getValidTextContentParts
} from "../../../util/compiler/template"
import {
    ensureIdWithPrefix,
    getAttributeBaseName,
    ensureIdWithNumSuffix
} from "../../../util/compiler/sundry"
import { TestingMode } from "../../enums"
import { DELEGATABLE_EVENTS } from "../../constants"
import { writeFragmentSelections } from "./fragment"
import { writeParsedExpression } from "./interpolation"
import { kebab2Camel } from "../../../util/compiler/string"
import { getMaybeReusedString } from "../../optimizer/compress"
import { getStriptTypeOperationsNode } from "../../ts-ast/sundry"
import { equalsWithKeyDirectiveValue } from "../../optimizer/render"
import { writeContextDeclaration, writeContextPatterns } from "./context"
import { analyzeResult, generateIdentifier, inputDescriptor } from "../../state"
import { isHtmlDirectiveChild, isValidIdentifierName } from "../../../util/compiler/assert"

export function generateTemplateRender(
    writer: RuntimeCodeWriter,
    nodes: TemplateNode[],
    isRoot = true
) {
    if (isRoot) {
        analyzeResult.template.keyedSelectorInfos.clear()
    }

    const componentFragment = analyzeResult.template.componentFragment

    if (isRoot && componentFragment?.content.length) {
        writeFragmentSelections(writer, componentFragment)
        generateRenderEffect(writer, nodes, null)
    }

    for (const node of nodes) {
        let insertPostfix: GeneralFunc | undefined
        const nodeContext = getTemplateNodeContext(node)
        const hasFragmentContent = !!nodeContext.fragment?.content.length

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

        if (
            nodeContext.sortedDirectives.some(item => {
                return item.name.raw !== "#slot"
            })
        ) {
            wrapInsertPostfix(generateDirectiveBlock(writer, 0, nodeContext))
        }
        if (node.componentTag) {
            generateComponentCall(writer, nodeContext)
            insertPostfix?.()
            continue
        }
        if ("slot" === node.tag) {
            wrapInsertPostfix(generateSlotCall(writer, nodeContext))
        }
        if (hasFragmentContent) {
            writeFragmentSelections(writer, nodeContext.fragment!)
            generateRenderEffect(writer, [node], node)
        }

        /**
         * 当节点上除了 #html 指令还存在其他指令时，{@link generateDirectiveBlock}
         * 方法不会为它生成指令块调用语句，因为此情况下调用语句必须等待其他节点（锚点）选择完成后才能生成
         *
         * When a node has other directives besides the #html directive, the {@link generateDirectiveBlock}
         * method will not generate the directive block call statement for it, because in this case the call
         * statement must wait until other nodes (anchor) are selected before it can be generated.
         */
        if (nodeContext.attributesMap["#html"] && nodeContext.sortedDirectives.length !== 1) {
            const htmlDirectiveIndex = nodeContext.sortedDirectives.findIndex(item => {
                return item.name.raw === "#html"
            })
            generateDirectiveBlock(writer, htmlDirectiveIndex, nodeContext)
        }

        if ((generateTemplateRender(writer, node.children, false), hasFragmentContent)) {
            writer.write(`\n${generateIdentifier.internal}.insertBefore(`)
            writer.write(`${nodeContext.anchorId}, ${nodeContext.fragment!.id})`)
        }

        insertPostfix?.()
    }

    if (isRoot) {
        const anchorId = generateIdentifier.anchor
        const internalId = generateIdentifier.internal
        const getterArgId = generateIdentifier.getterArg
        const instanceId = ensureIdWithPrefix("instance")
        const exportedBindings = new Map<string, string>()
        const hasComponentFragment = !!componentFragment?.content.length
        for (const binding of analyzeResult.script.exportedBindings) {
            exportedBindings.set(binding.exported, binding.local)
        }

        if (!exportedBindings.size) {
            if (!hasComponentFragment) {
                writer.write(`\nreturn ${internalId}.mount()`)
            } else {
                writer.write(`\nreturn ${internalId}.mount(`)
                writer.write(`${anchorId}, ${componentFragment.id})`)
            }
            return
        }

        writer.write(`\nconst ${instanceId} = ${internalId}.mount(`)

        if (hasComponentFragment) {
            writer.write(`${anchorId}, ${componentFragment.id}`)
        }
        writer.write(")").wrapLine().write("return ")
        writer.write(`${internalId}.defineExports(${instanceId}, {`).indent(false)

        for (const [exported, local] of exportedBindings) {
            const topLevelIdentifier = analyzeResult.script.topLevelIdentifiers[local]
            const transformed = topLevelIdentifier?.transformTo || local
            writer.wrapLine()
            writeContextKey(exported, writer)
            writer.write(`:  ${getterArgId} => (${transformed}),`)
        }
        writer.dedent().write(`})`)
    }
}

function generateDirectiveBlock(
    writer: RuntimeCodeWriter,
    directiveIndex: number,
    nodeContext: TemplateNodeContext
): GeneralFunc | undefined {
    const node = nodeContext.node
    const internalId = generateIdentifier.internal
    const getterArgId = generateIdentifier.getterArg
    const directive = nodeContext.sortedDirectives[directiveIndex]

    switch (directive?.name.raw) {
        case "#html": {
            writer.wrapLine().write(`${internalId}.htmlBlock(`).indent()
            writer.write(getTemplateNodeContext(nodeContext.node.children[0]).id)
            writer.writeLine(",").write(`${getterArgId} => (`)
            writer.writeInterpolatedText(node.children[0]).write(")")

            if (directive.equalSign) {
                writer.writeLine(",").write(`${getterArgId} => (`)
                writer.writeParsedExpression(directive).write(")")
            }
            return (writer.dedent().write(")"), undefined)
        }

        case "#target": {
            writer.wrapLine().write(`${internalId}.targetBlock(`).indent()
            writer.write(nodeContext.anchorId).writeLine(",").write(`${getterArgId} => (`)
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
            writer.write(`${getterArgId} => (`)
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
            writer.write(`${getterArgId} => (`).writeParsedExpression(directive).writeLine("),")

            if (noRender) {
                return (writer.writeLine(`${internalId}.UNDEF,`), generateNextDirective())
            }
            // fallthrough
        }
        case "#then": {
            if (!nodeContext.fragment?.content.length && !node.componentTag) {
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
                arg() {
                    const patterns = getParsedDirective(directive)?.patterns
                    if (!patterns) {
                        writer.write(getterArgId)
                    } else {
                        writer.write("(")
                        writeContextPatterns(writer, patterns).write(")")
                    }
                },
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
            const parsedDirective = getParsedDirective(directive)!
            const patterns = parsedDirective.patterns
            const keyDirective = nodeContext.attributesMap["#key"]
            const selectorInfos =
                keyDirective && !inputDescriptor.options.debug
                    ? getForBlockSelectorInfos(nodeContext)
                    : []
            const fn = keyDirective ? "keyedListBlock" : "listBlock"
            const nodeGetterId = selectorInfos.length ? ensureIdWithNumSuffix("_getNodeByKey") : ""

            if (keyDirective) {
                analyzeResult.template.keyedSelectorInfos.set(nodeContext, selectorInfos)
            }
            writer.wrapLine()

            if (nodeGetterId) {
                writer.write(`const ${nodeGetterId} = `)
            }
            writer.write(`${internalId}.${fn}(`).indent()

            if (keyDirective) {
                writer.write(nodeContext.anchorId).write(",").wrapLine()
                nodeContext.anchorId = ensureIdWithNumSuffix("_anchor")
            }
            writer.write(`${getterArgId} => (`)
            writer.writeParsedExpression(directive).write("),").wrapLine()

            if (keyDirective) {
                if (!patterns.length) {
                    writer.write(getterArgId)
                } else {
                    writer.write("(")
                    writeContextPatterns(writer, patterns).write(")")
                }
                writer.write(" => {").indent().write("return ")
                writer.writeParsedExpression(keyDirective).dedent().writeLine("},")
            }
            return generateDirectiveRender({
                context() {
                    writeContextDeclaration(writer, directive)
                },
                enclosure() {
                    writer.dedent().write(")")

                    if (nodeGetterId) {
                        for (const selectorInfo of selectorInfos) {
                            writeSelectorDeclaration(writer, selectorInfo, nodeGetterId)
                        }

                        writer.wrapLine().write(`${internalId}.renderEffect(() => {`).indent(false)
                        for (const selectorInfo of selectorInfos) {
                            writer.wrapLine().write(`${selectorInfo.id}(`)
                            writer.write(`${selectorInfo.topLevelTransformedTo})`)
                        }
                        writer.dedent().write("})")
                    }
                },
                arg() {
                    if (!patterns.length) {
                        if (!keyDirective) {
                            writer.write(getterArgId)
                        } else {
                            writer.write(nodeContext.anchorId)
                        }
                    } else {
                        if (keyDirective) {
                            writer.write(`(${nodeContext.anchorId}, `)
                        }
                        writer.write(parsedDirective.context!.argId).write(keyDirective ? ")" : "")
                    }
                },
                returns() {
                    if (inputDescriptor.options.debug && parsedDirective.context?.returnsId) {
                        writer.wrapLine().write(`return ${parsedDirective.context.returnsId}`)
                    }
                }
            })
        }
    }

    function generateDirectiveRender(
        insert?: Partial<{
            arg: GeneralFunc
            context: GeneralFunc
            returns: GeneralFunc
            enclosure: GeneralFunc
        }>
    ): GeneralFunc {
        if (insert?.arg) {
            insert.arg()
        } else {
            writer.write(getterArgId)
        }
        writer.write(" => {").indent(false)
        insert?.context?.()

        const childEnclosure = generateNextDirective()
        return () => {
            childEnclosure?.()
            insert?.returns?.()
            writer.dedent().write("}")
            insert?.enclosure?.()
        }
    }

    // 跳过 #html 指令的处理，推迟至节点选择完成后生成
    // Skip processing the `#html` directive; generate it after node selection is completed
    function generateNextDirective() {
        const delta = nodeContext.sortedDirectives[directiveIndex + 1]?.name.raw === "#html" ? 2 : 1
        return generateDirectiveBlock(writer, directiveIndex + delta, nodeContext)
    }
}

function generateRenderEffect(
    writer: RuntimeCodeWriter,
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

    const generate = (nodes: TemplateNode[], index: number, createRenderEffect: boolean) => {
        if (!nodes[index]) {
            return
        }

        const node = nodes[index]
        const nodeContext = getTemplateNodeContext(node)
        const selectorInfos = getActiveSelectorInfos(nodeContext)
        const textContentManagedBySelector = hasSelectorForTextNode(selectorInfos, nodeContext)
        const textContentHasRenderEffect =
            !textContentManagedBySelector && doesTextContentHasRenderEffect(node)

        const dfs = () => {
            if (node.children.length) {
                generate(node.children, 0, createRenderEffect)
            }
            if (nodes[index + 1]) {
                generate(nodes, index + 1, createRenderEffect)
            }
        }

        if (
            node.componentTag ||
            "slot" === node.tag ||
            (nodeContext.fragment && skipCheckNode !== node)
        ) {
            return generate(nodes, index + 1, createRenderEffect)
        }

        const generateSetAttributeCall = (attribute: TemplateAttribute) => {
            const baseName = getAttributeBaseName(attribute.name.raw)
            const interpolationSourceIndex = attribute.equalSign
                ? attribute.value.loc.start.index
                : attribute.loc.start.index
            if (createRenderEffect) {
                generateRenderEffectCall()
            }
            if (baseName === "class") {
                const staticClassAttr = nodeContext.attributesMap["class"]
                writer.wrapLine().write(`${internalId}.`)
                writer.write("setClassName", interpolationSourceIndex)
                writer.write("(").write(nodeContext.id).write(", ")

                if (staticClassAttr) {
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
                writer.write(`setSelectValue`, interpolationSourceIndex)
                writer.write(`(${nodeContext.id}, `).writeParsedExpression(attribute).write(")")
                return
            }

            const isXlinkAttr = baseName.startsWith("xlink:")
            const attrName = isXlinkAttr ? baseName.slice(6) : baseName
            const method = isXlinkAttr ? "setXlinkAttribute" : "setAttribute"
            writer.wrapLine().write(`${internalId}.`)
            writer.write(method, interpolationSourceIndex)
            writer.write(`(${nodeContext.id}, ${getMaybeReusedString(attrName)}, `)
            writer.writeParsedExpression(attribute).write(")")
        }

        const writeSetTextCall = () => {
            if (!isHtmlDirectiveChild(node) && node.content.some(part => part.isInterpolated)) {
                if (createRenderEffect) {
                    generateRenderEffectCall()
                }

                const firstInterpolatedPart = node.content.find(part => {
                    return part.isInterpolated
                })
                writer.wrapLine().write(`${internalId}.`)
                writer.write("setText", firstInterpolatedPart?.loc.start.index ?? -1)
                writer.write(`(${nodeContext.id}, `).writeInterpolatedText(node).write(")")
            }
        }

        // dynamic attributes
        const dynamicAttrsWithEffect: TemplateAttribute[] = []
        const dynamicAttrsWithoutEffect: TemplateAttribute[] = []
        for (const attribute of nodeContext.dynamicAttributes) {
            if (hasSelectorForAttribute(selectorInfos, nodeContext, attribute)) {
                continue
            }
            if (
                getParsedExpression(attribute)!.reactive &&
                !equalsWithKeyDirectiveValue(nodeContext, attribute)
            ) {
                dynamicAttrsWithEffect.push(attribute)
            } else {
                dynamicAttrsWithoutEffect.push(attribute)
            }
        }
        if (!createRenderEffect) {
            for (const attribute of dynamicAttrsWithoutEffect) {
                generateSetAttributeCall(attribute)
            }

            // event handlers
            for (const event of nodeContext.eventListeners) {
                const eventInfo = getParsedEventInfo(event)!
                const wrapperFlag = eventInfo.wrapperFlag
                const generalFlag = eventInfo.generalFlag
                const wrapperFlagNames = wrapperFlag.items.map(item => item.name)
                const generalFlagNames = generalFlag.items.map(item => item.name)

                const expression = getParsedExpression(event)!
                const baseName = eventInfo.eventName.slice(1)
                const delegated = DELEGATABLE_EVENTS.has(baseName)
                const stringifiedBaseName = getMaybeReusedString(baseName)
                const stripedTypeExpressionNode = getStriptTypeOperationsNode(expression.node)
                const insertInterpretiveComment = inputDescriptor.options.interpretiveComments
                writer.wrapLine().write(`${internalId}.${delegated ? "delegate" : "listen"}(`)
                writer.write(`${nodeContext.id}, `).write(stringifiedBaseName).write(", ")

                if (wrapperFlag.value) {
                    writer.write(`${internalId}.createEventWrapper(`)
                }
                if (
                    !isInlineEventHandler(stripedTypeExpressionNode) &&
                    isSimpleHandlerReference(stripedTypeExpressionNode)
                ) {
                    writer.writeParsedExpression(event)
                } else if (isFunctionLiteral(stripedTypeExpressionNode)) {
                    writer.writeParsedExpression(event)
                } else if (!isInlineEventHandler(stripedTypeExpressionNode)) {
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
                    if ((writer.write(", "), insertInterpretiveComment)) {
                        writer.write(`/* ${wrapperFlagNames.join(" | ")} */ `)
                    }
                    writer.write(wrapperFlag.value.toString()).write(")")
                }
                if (generalFlag.value) {
                    if ((writer.write(", "), insertInterpretiveComment)) {
                        writer.write(`/* ${generalFlagNames.join("| ")} */ `)
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
                    if (type === "both") {
                        writer.write(", ")
                    }
                    if (type !== "getter") {
                        writer.write(`${setterArgId} => (`).writeParsedExpression(attribute)
                        writer.write(` = ${setterArgId}`).write(")")
                    }
                    writer.write(")")
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
                        break
                    }
                    case "&handle": {
                        generateBindCall("bindHandleReceiver", "setter")
                        break
                    }
                    case "&value": {
                        if (node.tag !== "select") {
                            generateBindCall("bindInputValue", "both")
                        } else {
                            const multiple =
                                nodeContext.attributesMap["multiple"] ||
                                nodeContext.attributesMap["!multiple"]
                            generateBindCall("bindSelectValue", multiple ? "getter" : "both")
                        }
                        break
                    }
                }
            }

            if (!textContentHasRenderEffect && !textContentManagedBySelector) {
                writeSetTextCall()
            }
            dfs()
        }

        if (createRenderEffect) {
            for (const attribute of dynamicAttrsWithEffect) {
                generateSetAttributeCall(attribute)
            }
            if (textContentHasRenderEffect) {
                writeSetTextCall()
            }
            dfs()
        }
    }
    for (let i = 0; i < 2; i++) {
        generate(nodes, 0, !!i)
    }

    if (withinRenderEffect) {
        writer.dedent().write("})")
    }
}

function generateSlotCall(writer: RuntimeCodeWriter, nodeContext: TemplateNodeContext) {
    let needInsertComma = false

    const internalId = generateIdentifier.internal
    const contextId = generateIdentifier.context
    const hasDefaultContent = !!nodeContext.fragment?.content.length
    const slotName = nodeContext.attributesMap.name?.value.raw ?? "default"

    const insertTrailingComma = () => {
        if (needInsertComma) {
            writer.writeLine(",")
        }
        return ((needInsertComma = true), writer)
    }

    writer.wrapLine().write(`${internalId}.renderSlot(`)
    writer.write(`${contextId}, ${getMaybeReusedString(slotName)}, ${nodeContext.anchorId}`)

    if (
        nodeContext.dynamicAttributes.length ||
        nodeContext.staticAttributes.some(attr => attr.name.raw !== "name")
    ) {
        writer.writeLine(", {").indent()

        for (const attribute of nodeContext.dynamicAttributes) {
            const baseName = getAttributeBaseName(attribute.name.raw)
            insertTrailingComma()
            writeContextKey(baseName, writer)
            writer.write(": ").writeParsedExpression(attribute)
        }
        for (const attribute of nodeContext.staticAttributes) {
            const rawName = attribute.name.raw
            if (rawName === "name") {
                continue
            }
            insertTrailingComma()
            writeContextKey(attribute.name.raw, writer).write(": ")
            writer.write(attribute.equalSign ? getMaybeReusedString(attribute.value.raw) : "true")
        }
        writer.dedent().write("}")
    } else {
        writer.write(`, ${internalId}.UNDEF`)
    }

    if (hasDefaultContent) {
        writer.writeLine(", () => {").indent(false)
    }

    return () => {
        if (hasDefaultContent) {
            writer.dedent().write("}")
        }
        writer.write(")")
    }
}

function generateComponentCall(writer: RuntimeCodeWriter, nodeContext: TemplateNodeContext) {
    let needInsertComma = false

    const node = nodeContext.node
    const internalId = generateIdentifier.internal
    const componentId = generateIdentifier.component
    const getterArgId = generateIdentifier.getterArg
    const setterArgId = generateIdentifier.setterArg
    const maybeDynamic = getParsedExpression(node)?.reactive
    const scopeDirective = nodeContext.attributesMap["#scope"]
    const referenceHandleAttribute = nodeContext.attributesMap["&handle"]
    const isE2eTesting = inputDescriptor.options.testing === TestingMode.E2e

    const hasSlots = node.children.some(child => {
        return child.componentTag || getTemplateNodeContext(child).fragment!.content.length
    })
    const hasRefs = nodeContext.referenceAttributes.some(attr => {
        return attr.name.raw !== "&handle"
    })
    const hasStaticAttrs = !!nodeContext.staticAttributes.length
    const hasEventListeners = !!nodeContext.eventListeners.length
    const hasDynamicAttrs = !!nodeContext.dynamicAttributes.length
    const hasProps = hasStaticAttrs || hasEventListeners || hasDynamicAttrs
    const hasScope = !!(scopeDirective && (inputDescriptor.styles.length || isE2eTesting))

    const insertTrailingComma = () => {
        if (needInsertComma) {
            writer.writeLine(",")
        }
        return ((needInsertComma = true), writer)
    }

    if (maybeDynamic) {
        writer.wrapLine().write(`${internalId}.dynamicComponent(() => (`)
        writer.writeParsedExpression(node).write(`), ${componentId} => {`).indent(false)
    }
    if (referenceHandleAttribute) {
        writer.write(`\n${internalId}.bindHandleReceiver(`).indent(false)
    }
    if (maybeDynamic) {
        writer.write(`\n${componentId}(${nodeContext.anchorId}`)
    } else {
        writer.wrapLine().writeParsedExpression(node).write(`(${nodeContext.anchorId}`)
    }

    const hasContext = hasSlots || hasProps || hasRefs || hasScope
    if (hasContext) {
        writer.write(", {").indent()
    }

    if (hasProps) {
        writer.write("p: {").indent()

        for (const attribute of nodeContext.staticAttributes) {
            const baseName = getAttributeBaseName(attribute.name.raw)
            insertTrailingComma()
            writeContextKey(baseName, writer, true).write(": ")

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
            writeContextKey(baseName, writer, true)
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
            writeContextKey(baseName, writer, true).write(": ")
            writer.write(`${getterArgId} => (`).writeParsedExpression(attribute).write(")")
        }

        writer.dedent().write("}")
    }

    if (hasRefs && insertTrailingComma().write("r: {").indent()) {
        for (const attribute of nodeContext.referenceAttributes) {
            if (attribute.name.raw === "&handle") {
                continue
            }
            if (
                attribute !== nodeContext.referenceAttributes[0] &&
                !(
                    attribute === nodeContext.referenceAttributes[1] &&
                    nodeContext.referenceAttributes[0].name.raw === "&handle"
                )
            ) {
                insertTrailingComma()
            }
            writeContextKey(getAttributeBaseName(attribute.name.raw), writer, true)
            writer.write(": [").indent().write(`${getterArgId} => (`)
            writeParsedExpression(writer, attribute, false)
            writer.writeLine("),")
            writer.write(`${setterArgId} => (`)
            writer.writeParsedExpression(attribute)
            writer.write(` = ${setterArgId})`).dedent().write("]")
        }
        writer.dedent().write("}")
    }

    if (hasSlots) {
        insertTrailingComma().write("s: {").indent()
        needInsertComma = false

        for (const child of node.children) {
            const childContext = getTemplateNodeContext(child)
            if (!child.componentTag && !childContext.fragment!.content.length) {
                continue
            }

            const slotDirective = childContext.attributesMap["#slot"]
            const expression = slotDirective && getParsedExpression(slotDirective)
            const anchorId = (childContext.anchorId = ensureIdWithNumSuffix("_anchor"))
            const patterns = slotDirective && getParsedDirective(slotDirective)!.patterns
            const slotName = expression ? (expression.node as ts.StringLiteral).text : "default"
            insertTrailingComma()
            writeContextKey(slotName, writer, true).write(`: (${anchorId}`)

            if (patterns?.length) {
                writer.write(", ")
                writeContextPatterns(writer, patterns)
            }
            writer.write(") => {").indent(false)
            generateTemplateRender(writer, [child], false)
            writer.dedent().write("}")
        }
        writer.dedent().write("}")
    }

    if (hasScope) {
        const scopeName = getMaybeReusedString(` qk-${inputDescriptor.options.hashId}`)
        insertTrailingComma().write(`a: ${internalId}.getScopes(${scopeName})`)
    }

    if (hasContext) {
        writer.dedent().write("})")
    } else {
        writer.write(`)`)
    }

    if (referenceHandleAttribute) {
        writer.write(", ").wrapLine().write(`${setterArgId} => (`)
        writer.writeParsedExpression(referenceHandleAttribute)
        writer.write(` = ${setterArgId})`).dedent().write(")")
    }
    if (maybeDynamic) {
        writer.dedent().write("})")
    }
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

function writeContextKey(str: string, writer: RuntimeCodeWriter, toCamel = false) {
    if (toCamel) {
        str = kebab2Camel(str)
    }

    const reusedStringInfo = analyzeResult.reusedStrings[str]
    if (
        isValidIdentifierName(str) &&
        (str.length < 3 || !reusedStringInfo || reusedStringInfo.times < 2)
    ) {
        return writer.write(str)
    }
    return writer.write(`[${getMaybeReusedString(str)}]`)
}

function doesTextContentHasRenderEffect(node: TemplateNode) {
    if (!node?.content?.length) {
        return false
    }

    if (
        !node.content.some(part => {
            return part.isInterpolated && getParsedExpression(part)!.reactive
        })
    ) {
        return false
    }

    const validContentParts = getValidTextContentParts(node)
    return !(
        validContentParts.length === 1 &&
        validContentParts[0].isInterpolated &&
        equalsWithKeyDirectiveValue(getTemplateNodeContext(node), validContentParts[0])
    )
}

function getActiveSelectorInfos(nodeContext: TemplateNodeContext) {
    for (let currentNode: TemplateNode | null = nodeContext.node; currentNode; ) {
        const currentContext = getTemplateNodeContext(currentNode)
        const selectorInfos = analyzeResult.template.keyedSelectorInfos.get(currentContext)
        if (selectorInfos?.length) {
            return selectorInfos
        }
        currentNode = currentNode.parent
    }
    return []
}
