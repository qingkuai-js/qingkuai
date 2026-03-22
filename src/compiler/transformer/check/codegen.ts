import type {
    Range,
    ASTLocation,
    TemplateNode,
    TemplateAttribute
} from "#type-declarations/compiler"
import type { VariableDeclarator } from "@babel/types"
import type { ArbitraryFunc, GeneralFunc } from "#type-declarations/tools"

import {
    getParsedPatterns,
    getParsedEventInfo,
    getStartTagOpenLoc,
    getParsedExpression,
    getParsedComponentTag,
    getPrevElementContext,
    getTemplateNodeContext
} from "../../../util/compiler/template"
import { CodeEditor } from "../editor"
import { IntermediateCodeWriter } from "../writer"
import { isFunctionLiteral } from "../../estree/assert"
import { stringify } from "../../../util/shared/aliases"
import { stripTypeExpressions } from "../../estree/sundry"
import { traverseObject } from "../../../util/shared/sundry"
import { analyzeResult, inputDescriptor } from "../../state"
import { kebab2Camel, toPropertyKey } from "../../../util/compiler/string"
import { GET_TYPE_DELAY_MARKING, LANGUAGE_SERVICE_UTIL, SPREAD_TAG } from "../../constants"

export function generateIntermediateCode(nodes: TemplateNode[]) {
    let slotNamesType = ""
    traverseObject(analyzeResult.template.slots, name => {
        slotNamesType += stringify(name) + " | "
    })
    slotNamesType = slotNamesType.slice(0, -3)

    if (slotNamesType) {
        slotNamesType = `Record<${slotNamesType}, boolean>`
    }

    const isTS = inputDescriptor.script.isTS
    const writer = new IntermediateCodeWriter()
    const embeddedScriptEditor = new CodeEditor(
        inputDescriptor.script.code,
        inputDescriptor.script.loc.start.index
    )
    const { typeDeclarationFilePath } = inputDescriptor.options

    const UTILS = LANGUAGE_SERVICE_UTIL
    const ANY_VALUE = `${UTILS}.anyValue`
    const EMPTY_OBJECT = `${UTILS}.EmptyObject`
    const SLOT_NAMES_TYPE = slotNamesType || EMPTY_OBJECT

    const needImportItems: string[] = [
        UTILS,
        "raw",
        "alias",
        "derived",
        "derivedExp",
        "reactive",
        "shallow",
        "watch",
        "watchExp",
        "preWatch",
        "preWatchExp",
        "postWatch",
        "postWatchExp",
        "syncWatch",
        "syncWatchExp",
        "defaultRefs",
        "defaultProps"
    ]
    writer.writeLine(`import { ${needImportItems.join(", ")} } from "${typeDeclarationFilePath}";`)

    // 声明内置标识符及其默认类型
    // Declare built-in identifiers and their default types
    if (isTS) {
        writer.writeLine(`type Props = ${EMPTY_OBJECT}; type Refs = ${EMPTY_OBJECT};`)
        writer.write(
            `const props: Readonly<Props> = ${ANY_VALUE}, refs: Readonly<Refs> = ${ANY_VALUE}, slots: Readonly<${SLOT_NAMES_TYPE}> = ${ANY_VALUE};`
        )
    } else {
        writer.writeLine(
            `/** @typedef { ${EMPTY_OBJECT} } Refs @typedef { ${EMPTY_OBJECT} } Props */`
        )
        writer.write(
            `const /** @type { Readonly<Props> } */ props = 0, /** @type { Readonly<Refs> } */ refs = 0, /** @type { Readonly<${SLOT_NAMES_TYPE}> } */ slots = 0;`
        )
    }

    traverseObject(analyzeResult.script.topLevelIdentifiers, (_, info) => {
        const declarator = info.nodeInfos[0].declarator as VariableDeclarator
        if (
            info.status !== "derived" ||
            analyzeResult.script.declaratorToIntrinsic.has(declarator)
        ) {
            return
        }

        if (isFunctionLiteral(stripTypeExpressions(declarator.init!))) {
            embeddedScriptEditor.insert(declarator.init!.end!, ")")
            embeddedScriptEditor.insert(declarator.init!.start!, `${UTILS}.getReturnType(`)
        }
    })
    writer.wrapLine().writeEditedScript(embeddedScriptEditor).writeLine("\n\n;")

    //
    ;(function generate(nodes: TemplateNode[]) {
        for (const node of nodes) {
            const endInserts: GeneralFunc[] = []
            const isComponent = !!node.componentTag
            const isSpread = SPREAD_TAG === node.tag
            const nodeContext = getTemplateNodeContext(node)
            const startTagOpenLoc = getStartTagOpenLoc(node)
            const componentInvalidExps: [string, Range][] = []
            const slotNameRange = getRangeByLoc(
                nodeContext.attributesMap.name?.value.raw
                    ? nodeContext.attributesMap.name.loc
                    : startTagOpenLoc
            )
            const slotName = nodeContext.attributesMap.name?.value.raw ?? "default"
            const startTagRange: Range = [node.loc.start.index, node.startTagEndPos.index]
            const isSlot = "slot" === node.tag && node === analyzeResult.template.slots[slotName]

            const dedentAndWriteEndEnclosure = () => {
                writer.dedent().write("}")
            }

            const indentAndWriteStartEnclosure = (shouldWrapLine = true) => {
                if (shouldWrapLine) {
                    writer.wrapLine()
                }
                writer.write("{").indent(false)
                endInserts.push(dedentAndWriteEndEnclosure)
            }

            if (node.tag && node.parent?.componentTag && !nodeContext.attributesMap["#slot"]) {
                writer.wrapLine()
                writer.write("default", getRangeByLoc(startTagOpenLoc))
                writer.write(": () => ")
                endInserts.push(() => writer.write(","))
                indentAndWriteStartEnclosure(false)
            }

            for (const directive of nodeContext.sortedDirectives) {
                if (!directive.equalSign) {
                    continue
                }

                const rawName = directive.name.raw
                const rawValue = directive.value.raw
                const expression = getParsedExpression(directive)
                const valueEnd = directive.value.loc.end.index
                const expressionLen = expression?.source.length ?? 0
                const valueRange = getRangeByLoc(directive.value.loc)
                const directiveInfo = analyzeResult.template.parsedDirectives.get(directive)

                if (
                    !expression &&
                    rawName !== "#then" &&
                    rawName !== "#await" &&
                    rawName !== "#slot"
                ) {
                    const value = directiveInfo?.base ?? rawValue
                    const start = directiveInfo?.baseStartSourceIndex ?? valueRange[0]
                    writer.wrapLine().write(value, start).write(";")
                    continue
                }

                switch (directive.name.raw) {
                    case "#if":
                    case "#elif": {
                        writer.wrapLine().write(`if (`)
                        writer.write(rawValue, valueRange).write(") {}")
                        break
                    }

                    case "#for": {
                        indentAndWriteStartEnclosure()
                        generatePatterns(writer, valueRange[0], directive)
                        writer.write(`${UTILS}.getListPair(`)
                        writer.write(expression!.source, valueEnd - expressionLen)
                        writer.write(");")
                        break
                    }

                    case "#then": {
                        const awaitDirective =
                            nodeContext.attributesMap["#await"] ??
                            getPrevElementContext(node)?.attributesMap["#await"]
                        const awaitDirectiveExp = getParsedExpression(awaitDirective)
                        indentAndWriteStartEnclosure()

                        if (generatePatterns(writer, valueRange[0], directive)) {
                            if (!awaitDirectiveExp) {
                                writer.write(ANY_VALUE).write(";")
                            } else {
                                const awaitDirectExpStart = awaitDirective.value.loc.start.index
                                writer.write(`${UTILS}.getPromiseResolve(`)
                                writer.write(awaitDirectiveExp.source, awaitDirectExpStart)
                                writer.write(");")
                            }
                        } else {
                            writer.write(rawValue, valueRange)
                        }
                        break
                    }

                    case "#catch": {
                        indentAndWriteStartEnclosure()

                        if (generatePatterns(writer, valueRange[0], directive)) {
                            writer.write(ANY_VALUE).write(";")
                        } else {
                            writer.write(rawValue, valueRange)
                        }
                        break
                    }

                    case "#html": {
                        writer.wrapLine().write(`${UTILS}.validateHtmlBlockOptions(`)
                        writer.write(rawValue, valueRange).write(");")
                        break
                    }

                    case "#target": {
                        writer.wrapLine().write(`${UTILS}.validateTargetDirectiveValue(`)
                        writer.write(rawValue, valueRange).write(");")
                        break
                    }

                    case "#slot": {
                        if (node.parent?.componentTag) {
                            writer.wrapLine()

                            if (expression) {
                                writer.write(expression.source, expression.startSourceIndex)
                            } else {
                                writer.write("default", getRangeByLoc(startTagOpenLoc))
                            }
                            writer.write(": (")
                            generatePatterns(writer, valueRange[0], directive)
                            writer.write(") => ")
                            endInserts.push(() => writer.write(","))
                            indentAndWriteStartEnclosure(false)
                        } else if (expression) {
                            writer.wrapLine()
                            writer.write(expression.source, expression.startSourceIndex).write(";")
                        }
                        break
                    }

                    default: {
                        if (!isComponent) {
                            writer.write(rawValue, valueRange)
                        } else {
                            componentInvalidExps.push([rawValue, valueRange])
                        }
                        break
                    }
                }
            }

            if (isComponent) {
                endInserts.push(() => {
                    writer.dedent().write("});")

                    for (const [str, range] of componentInvalidExps) {
                        writer.wrapLine().write(str, range).write(";")
                    }
                })
                writer.wrapLine()

                if (node.rawTag !== node.tag || !getParsedExpression(node)) {
                    writer.write(ANY_VALUE)
                } else {
                    const componentTagParts = getParsedComponentTag(node)!
                    writer.write(`${UTILS}.confirmComponent(`)

                    for (let i = 0; i < componentTagParts.length; i++) {
                        if (i) {
                            writer.write(".")
                        }
                        writer.write(componentTagParts[i].id, componentTagParts[i].sourceRange)
                    }
                    writer.write(")")
                }
                writer.write("(").write("{", startTagRange[0]).indent(false)
            }

            if (isComponent || isSlot) {
                for (const attribute of nodeContext.staticAttributes) {
                    if (isSlot && "name" === attribute.name.raw) {
                        continue
                    }

                    const rawName = attribute.name.raw
                    const camelName = kebab2Camel(rawName)
                    const property = toPropertyKey(camelName)
                    const nameRange = getRangeByLoc(attribute.name.loc)
                    const valueRange = getRangeByLoc(attribute.value.loc)
                    const writeValue = attribute.equalSign ? stringify(attribute.value.raw) : "true"

                    if (isComponent) {
                        writer.wrapLine().write(property, nameRange)
                        writer.write(": ").write(writeValue, valueRange)
                    } else {
                        writer.wrapLine()
                        startGetTypeDelayMarkingCall(writer)
                        writer.write(stringify(slotName), slotNameRange).write(", ")
                        writer.write(stringify(camelName), nameRange).write(`, `)
                        writer.write(writeValue, valueRange).write(");")
                    }
                }
            }

            for (const attribute of nodeContext.dynamicAttributes) {
                const baseName = attribute.name.raw.slice(1)
                const camelName = kebab2Camel(baseName)
                const property = toPropertyKey(camelName)
                const rawValue = attribute.value.raw
                const expression = getParsedExpression(attribute)
                const nameRange = getRangeByLoc(attribute.name.loc)
                const valueRange = getRangeByLoc(attribute.value.loc)
                const isValueValid = attribute.valueEnclosure === "curly"

                if (!attribute.equalSign) {
                    if ((isSlot || isComponent) && !expression) {
                        continue
                    }
                    if (property) {
                        if (!isSlot) {
                            writer.wrapLine().write(property, nameRange)
                            writer.write(isComponent ? "," : ";")
                        } else {
                            writer.wrapLine()
                            startGetTypeDelayMarkingCall(writer)
                            writer.write(stringify(slotName), slotNameRange).write(", ")
                            writer.write(stringify(camelName), nameRange).write(", ")
                            writer.write(camelName, valueRange).write(");")
                        }
                    }
                    continue
                }

                if (!isValueValid) {
                    if (isComponent) {
                        writer.wrapLine().write(property, nameRange).write(": ")
                        writer.write(stringify(rawValue), valueRange).write(",")
                    }
                    continue
                }

                if (!expression && isComponent) {
                    componentInvalidExps.push([rawValue, valueRange])
                    continue
                }

                if (isComponent) {
                    writer.wrapLine()
                    writer.write(property, nameRange).write(": ")
                    writer.write(rawValue, valueRange).write(",")
                    continue
                }

                if (isSlot) {
                    writer.wrapLine()
                    startGetTypeDelayMarkingCall(writer)
                    writer.write(stringify(slotName), slotNameRange).write(", ")
                    writer.write(stringify(camelName), nameRange).write(`, `)
                    writer.write(rawValue, valueRange).write(");")
                    continue
                }

                writer.wrapLine().write(rawValue, valueRange).write(";")
            }

            for (const event of nodeContext.eventListeners) {
                const rawValue = event.value.raw
                const eventInfo = getParsedEventInfo(event)!
                const baseName = eventInfo.eventName.slice(1)
                const expression = getParsedExpression(event)
                const valueRange = getRangeByLoc(event.value.loc)
                const isValueValid = event.valueEnclosure === "curly"
                const property = toPropertyKey(kebab2Camel(baseName))
                const nameRange: Range = [
                    event.name.loc.start.index,
                    event.name.loc.start.index + eventInfo.eventName.length
                ]
                const validatorCall = `${UTILS}.validateEventHandler("${baseName}", `

                if (isSpread || isSlot) {
                    writer.wrapLine()

                    if (!event.equalSign) {
                        writer.write(property).write(";")
                    } else if (isValueValid) {
                        writer.write(rawValue, valueRange).write(";")
                    }
                    continue
                }

                if (!event.equalSign) {
                    if (isComponent && !expression) {
                        componentInvalidExps.push([property, nameRange])
                        continue
                    }
                    if (property) {
                        writer.wrapLine()

                        if (!isComponent) {
                            writer.write(validatorCall)
                        }
                        writer.write(property, nameRange)
                        writer.write(isComponent ? "," : ");")
                    }
                    continue
                }

                if (!isValueValid) {
                    if (isComponent) {
                        writer.wrapLine().write(property, nameRange)
                        writer.write(": ").write(stringify(rawValue), valueRange).write(",")
                    }
                    continue
                }

                if (!expression) {
                    if (isComponent) {
                        componentInvalidExps.push([rawValue, valueRange])
                    } else {
                        writer.wrapLine().write(rawValue, valueRange).write(";")
                    }
                    continue
                }

                if (!isComponent) {
                    writer.wrapLine().write(validatorCall)
                } else {
                    writer.wrapLine().write(property, nameRange).write(": ")
                }
                writer.write(rawValue, valueRange).write(isComponent ? "," : ");")
            }

            if (isComponent) {
                writer.dedent().write("}", startTagRange[1] - 1)
                writer.writeLine(",").write("{", startTagRange[0]).indent(false)
            }

            for (const attribute of nodeContext.referenceAttributes) {
                const rawName = attribute.name.raw
                const rawValue = attribute.value.raw
                const nameRange = getRangeByLoc(attribute.name.loc)
                const valueRange = getRangeByLoc(attribute.value.loc)
                const isValueValid = attribute.valueEnclosure === "curly"
                const property = toPropertyKey(kebab2Camel(rawName.slice(1)))
                const isAttributeValid =
                    analyzeResult.template.validReferenceAttributes.has(attribute)

                if (isComponent) {
                    if (!property) {
                        continue
                    }

                    if (!attribute.equalSign) {
                        if (getParsedExpression(attribute)) {
                            writer.wrapLine().write(property, nameRange).write(",")
                        }
                        continue
                    }

                    if (!isValueValid) {
                        writer.wrapLine().write(property, nameRange).write(": ")
                        writer.write(stringify(rawValue), valueRange).write(",")
                        continue
                    }

                    if (!isAttributeValid) {
                        componentInvalidExps.push([rawValue, valueRange])
                        continue
                    }

                    writer.wrapLine().write(property, nameRange).write(": ")
                    writer.write(rawValue, valueRange).write(",")
                    continue
                }

                if (!isAttributeValid) {
                    // SPREAD_TAG and slot tags will also enter
                    if (attribute.equalSign) {
                        writer.wrapLine().write(rawValue, valueRange).write(";")
                    } else if (property) {
                        writer.wrapLine().write(property, nameRange).write(";")
                    }
                    continue
                }

                const writeValue = (vname?: string, vparm?: string, ending = "") => {
                    if ((writer.wrapLine(), vname)) {
                        writer.write(`${UTILS}.validate${vname}(`)

                        if (vparm) {
                            writer.write(vparm + ", ")
                        }
                    }
                    if (!attribute.equalSign) {
                        writer.write(property, nameRange)
                    } else {
                        writer.write(rawValue, valueRange)
                    }
                    return writer.write(`${vname ? ")" : ""}${ending};`)
                }

                if ("textarea" === node.tag && rawName === "&value") {
                    writeValue("String")
                }

                if ("input" === node.tag) {
                    switch (rawName) {
                        case "&value": {
                            writeValue("String")
                            break
                        }
                        case "&number": {
                            writeValue("Number")
                            break
                        }
                        case "&checked": {
                            writeValue("Boolean")
                            break
                        }
                        case "&group": {
                            writeValue("ReferenecGroup")
                            break
                        }
                    }
                }

                if (rawName === "&dom") {
                    writeValue("DomReceiver", stringify(node.tag))
                }

                if ("select" === node.tag && rawName === "&value") {
                    if (nodeContext.attributesMap["multiple"]) {
                        writeValue(getParsedExpression(attribute) ? "ReferenceGroup" : undefined)
                        continue
                    }

                    // 待办：验证 option 元素的 value 属性是否可以被 select 元素的 &value 属性接受
                    // TODO: Verify whether the value attribute of the option element can be accepted by
                    // the &value attribute of the select element.
                    //
                    // walkOptionChildren(node, optionElement => {
                    //     const optionElementContext = getTemplateNodeContext(optionElement)
                    //     const staticValue = optionElementContext.attributesMap["value"]
                    //     const dyncmicValue = optionElementContext.attributesMap["!value"]
                    // })
                }

                writeValue(undefined, undefined, ` = ${ANY_VALUE}`)
            }

            for (const part of node.content) {
                if (part.isInterpolated) {
                    writer.wrapLine().write(part.value, part.loc.start.index).write(";")
                }
            }

            if (isComponent) {
                writer.dedent().write("}", startTagRange[1] - 1)
                writer.writeLine(",").write("{").indent(false)
            }

            generate(node.children)
            forEachRight(endInserts, fn => fn())
        }
    })(nodes)

    return writer.write("\n\n;\n\n")
}

function generatePatterns(
    writer: IntermediateCodeWriter,
    startSourceIndex: number,
    directive: TemplateAttribute
) {
    const directiveName = directive.name.raw
    const isForDirective = directiveName === "#for"
    const isSlotDirective = directiveName === "#slot"
    const patterns = getParsedPatterns(directive)?.slice(0, 2)
    if (!patterns?.some(pattern => pattern)) {
        if (!isSlotDirective) {
            writer.wrapLine()
        }
        return false
    }

    if (!isSlotDirective) {
        writer.wrapLine().write("const ")

        if (isForDirective) {
            writer.write("[")
        }
    }
    for (let i = 0; i < patterns.length; i++) {
        const patternNode = patterns[i]?.node
        if (patternNode) {
            const end = patternNode.end! + startSourceIndex
            const start = patternNode.start! + startSourceIndex
            writer.write(inputDescriptor.source.slice(start, end), start)
        }
        if (i && isForDirective && patterns[i + 1]) {
            writer.write(", ")
        }
    }
    if (!isSlotDirective) {
        if (isForDirective) {
            writer.write("]")
        }
        writer.write(" = ")
    }
    return true
}

function getRangeByLoc(loc: ASTLocation): Range {
    return [loc.start.index, loc.end.index]
}

function forEachRight(arr: any[], cb: ArbitraryFunc) {
    for (let i = arr.length - 1; i >= 0; i--) {
        cb(arr[i], i, arr)
    }
}

function startGetTypeDelayMarkingCall(writer: IntermediateCodeWriter) {
    writer.gtdii.push(writer.length)
    writer.write(`${GET_TYPE_DELAY_MARKING}(`)
}
