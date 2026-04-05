import type {
    Range,
    ASTLocation,
    TemplateNode,
    TemplateAttribute,
    ParsedExpression
} from "#type-declarations/compiler"
import type { VariableDeclarator } from "@babel/types"
import type { ArbitraryFunc, GeneralFunc } from "#type-declarations/tools"

import {
    getParsedExpression,
    getParsedEventInfo,
    getStartTagOpenLoc,
    getParsedDirective,
    getParsedComponentTag,
    getPrevElementContext,
    getTemplateNodeContext
} from "../../../util/compiler/template"
import { CodeEditor } from "../editor"
import { LSC, SPREAD_TAG } from "../../constants"
import { IntermediateCodeWriter } from "../writer"
import { stringify } from "../../../util/shared/aliases"
import { stripTypeExpressions } from "../../estree/sundry"
import { traverseObject } from "../../../util/shared/sundry"
import { analyzeResult, inputDescriptor } from "../../state"
import { kebab2Camel, toPropertyKey } from "../../../util/compiler/string"
import { isFunctionLiteral, isInlineEventHandler } from "../../estree/assert"

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
    const scriptDescriptor = inputDescriptor.script
    const { typeDeclarationFilePath } = inputDescriptor.options
    const exportSourceRange: Range | undefined = inputDescriptor.script.existing
        ? [scriptDescriptor.startTagOpenRange[0] + 1, scriptDescriptor.startTagOpenRange[1]]
        : undefined

    const ANY_VALUE = `${LSC.UTIL}.anyValue`
    const SLOT_NAMES_TYPE = slotNamesType || `${LSC.UTIL}.EmptyObject`
    const COMPONENT_TYPE = `${LSC.UTIL}.QingkuaiComponent<ReturnType<typeof ${LSC.COMPONENT}>>`

    const needImportItems: string[] = [
        LSC.UTIL,
        "raw",
        "alias",
        "derived",
        "derivedExp",
        "reactive",
        "shallow",
        "watchExp",
        "preWatchExp",
        "postWatchExp",
        "syncWatchExp",
        "defaultRefs",
        "defaultProps"
    ]
    writer.writeLine(`import { ${needImportItems.join(", ")} } from "${typeDeclarationFilePath}";`)

    for (const importDeclaration of analyzeResult.script.importDeclarations) {
        embeddedScriptEditor.remove(...importDeclaration.value.range!)
        writer.writeScriptNode(importDeclaration.value).writeLine(";")
    }
    writer.write("\nfunction __qk__component(){").indent()

    if (isTS) {
        writer.writeLine(`const slots: Readonly<${SLOT_NAMES_TYPE}> = ${ANY_VALUE};`)
    } else {
        writer.writeLine(`/** @type { Readonly<${SLOT_NAMES_TYPE}> } */ slots = 0;`)
    }
    writer.dedent(false)

    traverseObject(analyzeResult.script.topLevelIdentifiers, (_, info) => {
        const declarator = info.nodeInfos[0].declarator as VariableDeclarator
        if (
            info.status !== "derived" ||
            analyzeResult.script.declaratorToIntrinsic.has(declarator)
        ) {
            return
        }

        if (declarator.init && isFunctionLiteral(stripTypeExpressions(declarator.init))) {
            embeddedScriptEditor.insert(declarator.init!.end!, ")")
            embeddedScriptEditor.insert(declarator.init!.start!, `${LSC.UTIL}.getReturnType(`)
        }
    })
    writer.wrapLine().writeEditedScript(embeddedScriptEditor).indent().writeLine(";\n")

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

            const indentAndWriteStartEnclosure = (
                shouldWrapLine = true,
                closeWithSemicolon = true
            ) => {
                if (shouldWrapLine) {
                    writer.wrapLine()
                }
                writer.write("{").indent(false)
                endInserts.push(() => writer.dedent().write(closeWithSemicolon ? "};" : "}"))
            }

            if (node.tag && node.parent?.componentTag && !nodeContext.attributesMap["#slot"]) {
                writer.wrapLine()
                writer.write("default", getRangeByLoc(startTagOpenLoc))
                writer.write(": () => ")
                endInserts.push(() => writer.write(","))
                indentAndWriteStartEnclosure(false, false)
            }

            for (const directive of nodeContext.sortedDirectives) {
                if (!directive.equalSign) {
                    continue
                }

                const rawValue = directive.value.raw
                const valueEnd = directive.value.loc.end.index
                const valueRange = getRangeByLoc(directive.value.loc)
                const parsedExpression = getParsedExpression(directive)
                const expressionLen = parsedExpression?.source.length ?? 0
                const directiveInfo = analyzeResult.template.parsedDirectives.get(directive)

                switch (directive.name.raw) {
                    case "#if":
                    case "#elif": {
                        writer.wrapLine().write(`if (`)
                        writer.write(rawValue, valueRange).write(") {}")
                        break
                    }

                    case "#for": {
                        indentAndWriteStartEnclosure()

                        if (directiveInfo && !parsedExpression) {
                            writeInvalidExpression(
                                writer,
                                directiveInfo.base,
                                directiveInfo.baseStartSourceIndex
                            )
                        }
                        if (generatePatterns(writer, directive)) {
                            writer.write(`${LSC.UTIL}.getListPair(`)

                            if (parsedExpression) {
                                writer.write(parsedExpression.source, valueEnd - expressionLen)
                            }
                            writer.write(");")
                        }
                        break
                    }

                    case "#then": {
                        const awaitDirective =
                            nodeContext.attributesMap["#await"] ??
                            getPrevElementContext(node)?.attributesMap["#await"]
                        const awaitDirectiveExp = getParsedExpression(awaitDirective)
                        if ((writer.wrapLine(), !awaitDirectiveExp)) {
                            writer.write(";(").indent(false)
                        } else {
                            writer.write(
                                awaitDirectiveExp.source,
                                awaitDirective.value.loc.start.index
                            )
                            writer.write(".then((").indent(false)
                        }
                        generatePatterns(writer, directive)
                        writer.write(") => {")
                        endInserts.push(() => writer.dedent().write("});"))
                        break
                    }

                    case "#catch": {
                        indentAndWriteStartEnclosure()

                        if (generatePatterns(writer, directive)) {
                            writer.write(ANY_VALUE).write(";")
                        } else {
                            writeInvalidExpression(writer, rawValue, valueRange)
                        }
                        break
                    }

                    case "#html": {
                        if (!parsedExpression) {
                            writeInvalidExpression(writer, rawValue, valueRange)
                        } else {
                            writer.wrapLine().write(`${LSC.UTIL}.validateHtmlBlockOptions(`)
                            writer.write(rawValue, valueRange).write(");")
                        }
                        break
                    }

                    case "#target": {
                        if (!parsedExpression) {
                            writeInvalidExpression(writer, rawValue, valueRange)
                        } else {
                            writer.wrapLine().write(`${LSC.UTIL}.validateTargetDirectiveValue(`)
                            writer.write(rawValue, valueRange).write(");")
                        }
                        break
                    }

                    case "#slot": {
                        if (node.parent?.componentTag) {
                            writer.wrapLine()

                            if (parsedExpression) {
                                writeParsedExpression(writer, parsedExpression)
                            } else {
                                writer.write("default", getRangeByLoc(startTagOpenLoc))
                            }
                            writer.write(": (")
                            generatePatterns(writer, directive)
                            writer.write(") => ")
                            endInserts.push(() => writer.write(","))
                            indentAndWriteStartEnclosure(false, false)

                            if (directiveInfo && !parsedExpression) {
                                writeInvalidExpression(
                                    writer,
                                    directiveInfo.base,
                                    directiveInfo.baseStartSourceIndex
                                )
                            }
                        } else if (parsedExpression) {
                            writer.wrapLine()
                            writeParsedExpression(writer, parsedExpression).write(";")
                        }
                        break
                    }

                    default: {
                        if (!isComponent) {
                            writer.write(rawValue, valueRange).write(";")
                        } else {
                            componentInvalidExps.push([rawValue, valueRange])
                        }
                        break
                    }
                }
            }

            if (isComponent) {
                endInserts.push(() => {
                    writer.dedent().write("}").dedent().write("});")

                    for (const [str, range] of componentInvalidExps) {
                        writeInvalidExpression(writer, str, range)
                    }
                })
                writer.wrapLine()

                if (node.rawTag !== node.tag || !getParsedExpression(node)) {
                    writer.write(ANY_VALUE)
                } else {
                    const componentTagParts = getParsedComponentTag(node)!
                    writer.write(`${LSC.UTIL}.confirmComponent(`)

                    for (let i = 0; i < componentTagParts.length; i++) {
                        if (i) {
                            writer.write(".")
                        }
                        writer.write(componentTagParts[i].id, componentTagParts[i].sourceRange)
                    }
                    writer.write(")")
                }
                if (node.typeArgument) {
                    const typeArgumentRange = getRangeByLoc(node.typeArgument.loc)
                    writer.write("<").write(node.typeArgument.raw, typeArgumentRange).write(">")
                }
                writer.write("(").write("{").indent()
                writer.write("props: ").write("{", startTagRange[0]).indent(false)
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
                        writer.write(": ").write(writeValue, valueRange).write(",")
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

                writeOrphanExpression(writer, rawValue, valueRange)
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
                const validatorCall = `${LSC.UTIL}.validateEventHandler("${baseName}", `

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

                const isInline = isInlineEventHandler(expression.node)
                if (isInline) {
                    writer.write("$arg", nameRange).write(" => (")
                }
                writer.write(rawValue, valueRange)
                writer.write(`${isInline ? ")" : ""}${isComponent ? "," : ");"}`)
            }

            if (isComponent) {
                writer.dedent().write("}", startTagRange[1] - 1)
                writer.writeLine(",").write("refs: ").write("{", startTagRange[0]).indent(false)
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
                        writer.write(`${LSC.UTIL}.validate${vname}(`)

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
                writer.writeLine(",").write("slots: {").indent(false)
            }

            generate(node.children)
            forEachRight(endInserts, fn => fn())
        }
    })(nodes)

    writer.write(`\n\nreturn (_) => {}`).dedent().write("}\n\n")

    if (isTS) {
        writer.write(`export `)
        writer.write("default", exportSourceRange)
        return writer.write(` ${ANY_VALUE} as ${COMPONENT_TYPE};`)
    }
    writer.write(`/** @type { ${COMPONENT_TYPE} } */\nexport `)
    writer.write("default", exportSourceRange)
    return writer.write(` ${ANY_VALUE};`)
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
    writer.write(`${LSC.GET_TYPE_DELAY_MARKING}(`)
}

function writeOrphanExpression(
    writer: IntermediateCodeWriter,
    expression: string,
    sourceIndexOrRange: number | Range
) {
    writer.wrapLine().write("void(")

    // @ts-expect-error: match the overload
    return writer.write(expression, sourceIndexOrRange).write(");")
}

function writeInvalidExpression(
    writer: IntermediateCodeWriter,
    str: string,
    sourceIndexOrRange: number | Range
) {
    // @ts-expect-error: match the overload
    return writer.wrapLine().write(str, sourceIndexOrRange).write(";")
}

function generatePatterns(writer: IntermediateCodeWriter, directive: TemplateAttribute) {
    const directiveName = directive.name.raw
    const isForDirective = directiveName === "#for"
    const isCatchDirective = directiveName === "#catch"
    const patterns = getParsedDirective(directive)?.patterns
    if (!patterns?.some(pattern => pattern)) {
        if (isForDirective || isCatchDirective) {
            writer.wrapLine()
        }
        return false
    }
    if (isForDirective || isCatchDirective) {
        writer.wrapLine().write("const " + (isForDirective ? "[" : ""))
    }
    for (let i = 0; i < patterns.length; i++) {
        if (patterns[i].node) {
            writer.write(
                inputDescriptor.source.slice(...patterns[i].sourceRange),
                patterns[i].sourceRange[0]
            )
        }
        if (i < patterns.length - 1) {
            writer.write(", ")
        }
    }
    if (isForDirective || isCatchDirective) {
        writer.write(isCatchDirective ? " = " : "] = ")
    }
    return true
}

function writeParsedExpression(writer: IntermediateCodeWriter, parsedExpression: ParsedExpression) {
    return writer.write(parsedExpression.source, parsedExpression.startSourceIndex)
}
