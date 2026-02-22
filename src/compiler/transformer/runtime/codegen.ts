import type { TemplateNode } from "#type-declarations/compiler"

import {
    ensureIdWithPrefix,
    ensureIdWithNumSuffix,
    getStringifiedLiteral,
    shouldExtractCommonString
} from "../../../util/compiler/sundry"
import { CodeWriter } from "../writer"
import { CodeEditor } from "../editor"
import { transformEmbeddedScript } from "./script"
import { arrayFrom } from "../../../util/shared/arrays"
import { traverseObject } from "../../../util/shared/sundry"
import { analyzeResult, inputDescriptor } from "../../state"
import { objectAssign, stringify } from "../../../util/shared/aliases"
import { findNonWhitespaceChar, findNonWhitespaceCharRight } from "../../../util/compiler/string"

export function generateRuntimeCode(nodes: TemplateNode[]) {
    let hasTopExtra = false
    let extractCommonStrCount = 0

    const { code: scriptSource, loc: scriptLoc } = inputDescriptor.script
    const { importDeclarations, defaultProps, defaultRefs } = analyzeResult.script

    objectAssign(analyzeResult.generateIds, {
        internal: ensureIdWithPrefix("_"),
        setterArg: ensureIdWithPrefix("v")
    })

    const writer = new CodeWriter(true)
    const scriptHoistWriter = new CodeWriter()
    const targetId = ensureIdWithPrefix("target")
    const contextId = ensureIdWithPrefix("context")
    const internalId = analyzeResult.generateIds.internal
    const componentName = inputDescriptor.options.componentName
    const embeddedScriptEditor = new CodeEditor(scriptSource, scriptLoc.start.index)

    transformEmbeddedScript(scriptHoistWriter, embeddedScriptEditor)

    const eliminateNodes = arrayFrom(analyzeResult.script.eliminateNodes).sort((a, b) => {
        return a.start! - b.start!
    })
    for (let i = 0, prevEnd = 0; i < eliminateNodes.length; i++) {
        const end =
            i === eliminateNodes.length - 1
                ? eliminateNodes[i].end!
                : findNonWhitespaceChar(scriptSource, eliminateNodes[i].end!)
        const start = findNonWhitespaceCharRight(scriptSource, eliminateNodes[i].start!)
        embeddedScriptEditor.remove(Math.max(prevEnd, start), (prevEnd = end))
    }

    for (const declaration of importDeclarations) {
        writer.writeScriptNode(declaration.value).wrapLine()
    }
    writer.write(`import * as ${internalId} from "qingkuai/internal";`).wrapLine(2)

    // 重复使用的字符串字面量将被声明为常量，这里用于确定其标识符名称
    // Reused string literals will be declared as constants; this is used to determine their identifier names.
    traverseObject(analyzeResult.commonStrings, (key, value) => {
        if (shouldExtractCommonString(key, value.times)) {
            hasTopExtra = true
            value.id = ensureIdWithNumSuffix("_s", ++extractCommonStrCount)
            writer.write(`const ${value.id} = ${stringify(key)};`).wrapLine()
        }
    })

    hasTopExtra && writer.wrapLine()

    writer.write(`export default function ${componentName}(${targetId}, ${contextId}) {`)

    writeDelegateEventsRegistration(writer)

    scriptHoistWriter.empty || writer.write(scriptHoistWriter.code).wrapLine()

    writer.write(`const refs = ${internalId}.initRefs(${contextId}.r`)
    defaultRefs && writer.write(", ").writeScriptNode(defaultRefs.value)
    writer.write(");").wrapLine()

    writer.write(`const props = ${internalId}.initProps(${contextId}.p`)
    defaultProps && writer.write(", ").writeScriptNode(defaultProps.value)
    writer.write(");").wrapLine()

    writer.write(`const slots = ${internalId}.initSlots(${contextId}.s);`)

    writer.writeEditedScript(embeddedScriptEditor)

    writer.dedent().write("}")

    return {
        code: writer.code,
        mappings: writer.mappings
    }
}

// 生成 <interna>.init 方法调用代码，用于注册被委托的事件
// Generate code for the `<internal>.init` method call, used to register delegated events.
function writeDelegateEventsRegistration(writer: CodeWriter) {
    const passiveEvents: string[] = []
    const nonPassiveEvents: string[] = []
    const { delegateEvents } = analyzeResult.template
    traverseObject(delegateEvents, (_, value, index) => {
        const container = index ? nonPassiveEvents : passiveEvents
        for (const item of value) {
            container.push(getStringifiedLiteral(item))
        }
    })

    const passiveLen = passiveEvents.length
    const nonPassiveLen = nonPassiveEvents.length
    const internalId = analyzeResult.generateIds.internal
    const shouldWrapLine = passiveLen + nonPassiveLen > 10
    const seperator = ", " + (shouldWrapLine ? "\n" : "")
    const concatSeperatorCount = passiveLen ? (nonPassiveLen ? 2 : 1) : 0
    writer.indent().write(`${internalId}.init([`)
    shouldWrapLine && writer.indent()

    writer.write(nonPassiveEvents.join(seperator))
    writer.write(seperator.repeat(concatSeperatorCount))
    writer.write(passiveEvents.join(seperator))

    shouldWrapLine && writer.dedent()
    writer.write("]);").wrapLine(2)
}
