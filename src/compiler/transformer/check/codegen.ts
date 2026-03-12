import type {
    Range,
    ASTLocation,
    TemplateNode,
    TemplateAttribute
} from "#type-declarations/compiler"
import type { VariableDeclarator } from "@babel/types"
import type { ArbitraryFunc, GeneralFunc } from "#type-declarations/tools"

import {
    getStartTagLoc,
    getParsedPatterns,
    getParsedEventInfo,
    getStartTagOpenLoc,
    getParsedExpression,
    getPrevElementContext,
    getTemplateNodeContext
} from "../../../util/compiler/template"
import { CodeEditor } from "../editor"
import { IntermediateCodeWriter } from "../writer"
import { isFunctionLiteral } from "../../estree/assert"
import { stringify } from "../../../util/shared/aliases"
import { stripTypeExpressions } from "../../estree/sundry"
import { kebab2Camel } from "../../../util/compiler/string"
import { traverseObject } from "../../../util/shared/sundry"
import { analyzeResult, inputDescriptor } from "../../state"
import { GET_TYPE_DELAY_MARKING, LANGUAGE_SERVICE_UTIL, SPREAD_TAG } from "../../constants"

export function generateIntermediateCode(nodes: TemplateNode[]) {
    let slotNamesType = ""
    traverseObject(analyzeResult.template.slots, name => {
        slotNamesType += stringify(name) + " | "
    })
    slotNamesType = slotNamesType.slice(0, -3)
    slotNamesType && (slotNamesType = `Record<${slotNamesType}, boolean>`)

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
            `const props: Props = ${ANY_VALUE}, refs: Refs = ${ANY_VALUE}, slots: ${SLOT_NAMES_TYPE} = ${ANY_VALUE};`
        )
    } else {
        writer.writeLine(
            `/** @typedef { ${EMPTY_OBJECT} } Refs @typedef { ${EMPTY_OBJECT} } Props */`
        )
        writer.write(
            `const /** @type { Props } */ props = 0, /** @type { Refs } */ refs = 0, /** @type { ${SLOT_NAMES_TYPE} } */ slots = 0;`
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
            const componentInvalidExps: [string, Range][] = []
            const slotNameLoc = nodeContext.attributesMap.name
                ? nodeContext.attributesMap.name.loc
                : getStartTagLoc(node)
            const slotNameRange = getRangeByLoc(slotNameLoc)
            const slotName = nodeContext.attributesMap.name?.value.raw ?? "default"
            const isSlot = "slot" === node.tag && node === analyzeResult.template.slots[slotName]

            const dedentAndWriteEndEnclosure = () => {
                writer.dedent().write("}")
            }

            const indentAndWriteStartEnclosure = (wrapLine = true) => {
                wrapLine && writer.wrapLine()
                writer.write("{").indent(false)
                endInserts.push(dedentAndWriteEndEnclosure)
            }

            if (node.tag && node.parent?.componentTag && !nodeContext.attributesMap["#slot"]) {
                writer.wrapLine()
                writer.write('"default"', getRangeByLoc(getStartTagOpenLoc(node)))
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
                const directiveInfo = analyzeResult.template.directiveIndos.get(directive)

                if (!expression && rawName !== "#then" && rawName !== "#await") {
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
                                writer.write('"default"', getRangeByLoc(getStartTagOpenLoc(node)))
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

            if (node.componentTag) {
                const tagNameLoc = getStartTagLoc(node)
                const tagNameRange: Range = [tagNameLoc.start.index, tagNameLoc.end.index]
                endInserts.push(() => {
                    writer.dedent().write("});")

                    for (const [str, range] of componentInvalidExps) {
                        writer.wrapLine().write(str, range).write(";")
                    }
                })
                writer.wrapLine()
                writer.write(node.componentTag, tagNameRange)
                writer.write("({").indent(false)
            }

            if (isComponent || isSlot) {
                for (const attribute of nodeContext.staticAttributes) {
                    if (isSlot && "name" === attribute.name.raw) {
                        continue
                    }

                    const camelName = kebab2Camel(attribute.name.raw)
                    const nameRange = getRangeByLoc(attribute.name.loc)
                    const valueRange = getRangeByLoc(attribute.value.loc)
                    const writeValue = attribute.equalSign ? stringify(attribute.value.raw) : "true"

                    if (isComponent) {
                        writer.wrapLine().write(camelName, nameRange)
                        writer.write(": ").write(writeValue, valueRange)
                    } else {
                        writer.wrapLine()
                        startGetTypeDelayMarkingCall(writer)
                        writer.write(stringify(slotName), slotNameRange).write(", ")
                        writer.write(stringify(camelName), nameRange).write(`, ${writeValue});`)
                    }
                }
            }

            for (const attribute of nodeContext.dynamicAttributes) {
                const rawValue = attribute.value.raw
                const baseName = attribute.name.raw.slice(1)
                const camelName = kebab2Camel(baseName)
                const expression = getParsedExpression(attribute)
                const nameRange = getRangeByLoc(attribute.name.loc)
                const valueRange = getRangeByLoc(attribute.value.loc)
                const isValueValid = attribute.valueEnclosure === "curly"

                if (!attribute.equalSign) {
                    if (camelName) {
                        if (!isSlot) {
                            writer.wrapLine().write(camelName, nameRange)
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
                        writer.wrapLine().write(camelName, nameRange).write(": ")
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
                    writer.write(camelName, nameRange).write(": ")
                    writer.write(rawValue, valueRange).write(",")
                    continue
                }

                if (!isSlot) {
                    writer.wrapLine().write(rawValue, valueRange).write(";")
                    continue
                }
                writer.wrapLine()
                startGetTypeDelayMarkingCall(writer)
                writer.write(stringify(slotName), slotNameRange).write(", ")
                writer.write(stringify(baseName), nameRange).write(`, ${rawValue});`)
            }

            for (const event of nodeContext.eventListeners) {
                const rawValue = event.value.raw
                const eventInfo = getParsedEventInfo(event)!
                const baseName = eventInfo.eventName.slice(1)
                const camelBaseNeme = kebab2Camel(baseName)
                const expression = getParsedExpression(event)
                const valueRange = getRangeByLoc(event.value.loc)
                const isValueValid = event.valueEnclosure === "curly"
                const nameRange: Range = [
                    event.name.loc.start.index,
                    event.name.loc.start.index + eventInfo.eventName.length
                ]
                const validatorCall = `${UTILS}.validateEventHandler("${baseName}", `

                if (isSpread || isSlot) {
                    writer.wrapLine()

                    if (!event.equalSign) {
                        writer.write(camelBaseNeme).write(";")
                    } else if (isValueValid) {
                        writer.write(rawValue, valueRange).write(";")
                    }
                    continue
                }

                if (!event.equalSign) {
                    if (camelBaseNeme) {
                        writer.wrapLine()

                        if (!isComponent) {
                            writer.write(validatorCall)
                        }
                        writer.write(camelBaseNeme, nameRange)
                        writer.write(isComponent ? "," : ");")
                    }
                    continue
                }

                if (!isValueValid) {
                    if (isComponent) {
                        writer.wrapLine().write(camelBaseNeme, nameRange)
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
                    writer.wrapLine().write(camelBaseNeme, nameRange).write(": ")
                }
                writer.write(rawValue, valueRange).write(isComponent ? "," : ");")
            }

            if (isComponent) {
                writer.dedent().write("},").wrapLine().write("{").indent(false)
            }

            for (const attribute of nodeContext.referenceAttributes) {
                const rawName = attribute.name.raw
                const rawValue = attribute.value.raw
                const camelName = kebab2Camel(rawName.slice(1))
                const nameRange = getRangeByLoc(attribute.name.loc)
                const valueRange = getRangeByLoc(attribute.value.loc)
                const isValueValid = attribute.valueEnclosure === "curly"
                const isAttributeValid =
                    analyzeResult.template.validReferenceAttributes.has(attribute)

                if (isComponent) {
                    if (!camelName) {
                        continue
                    }

                    if (!attribute.equalSign) {
                        writer.wrapLine().write(camelName, nameRange).write(",")
                        continue
                    }

                    if (!isValueValid) {
                        writer.wrapLine().write(camelName, nameRange).write(": ")
                        writer.write(stringify(rawValue), valueRange).write(",")
                        continue
                    }

                    if (!isAttributeValid) {
                        componentInvalidExps.push([rawValue, valueRange])
                        continue
                    }

                    writer.wrapLine().write(camelName, nameRange).write(": ")
                    writer.write(rawValue, valueRange).write(",")
                    continue
                }

                if (!isAttributeValid) {
                    // SPREAD_TAG and slot tags will also enter
                    if (attribute.equalSign) {
                        writer.wrapLine().write(rawValue, valueRange).write(";")
                    } else if (camelName) {
                        writer.wrapLine().write(camelName, nameRange).write(";")
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
                        writer.write(camelName, nameRange)
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

                    // 待办：验证 option 元素的 value 属性是否可以被 select 的 &value 接受
                    // TODO: Verify whether the `value` attribute of the `option` element can be accepted by `select`'s `&value`
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
                writer.dedent().write("},").wrapLine().write("{").indent(false)
            }

            ;(generate(node.children), forEachRight(endInserts, fn => fn()))
        }
    })(nodes)

    return writer.write("\n\n;\n\n")
}

function generatePatterns(
    writer: IntermediateCodeWriter,
    startSourceIndex: number,
    directive: TemplateAttribute
) {
    const patterns = getParsedPatterns(directive)?.slice(0, 2)
    if (!patterns?.some(pattern => pattern)) {
        return (writer.wrapLine(), false)
    }

    const directiveName = directive.name.raw
    const isForDirective = directiveName === "#for"
    const isSlotDirective = directiveName === "#slot"
    if (!isSlotDirective) {
        writer.wrapLine().write("const ")
        isForDirective && writer.write("[")
    }
    for (let i = 0; i < patterns.length; i++) {
        if (patterns[i]) {
            const end = patterns[i]!.end! + startSourceIndex
            const start = patterns[i]!.start! + startSourceIndex
            writer.write(inputDescriptor.source.slice(start, end), start)
        }
        !i && isForDirective && patterns[i + 1] && writer.write(", ")
    }
    if (!isSlotDirective) {
        isForDirective && writer.write("]")
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
    writer.write(`${LANGUAGE_SERVICE_UTIL}.${GET_TYPE_DELAY_MARKING}(`)
}
