import type { TemplateNode } from "#type-declarations/compiler"

import {
    ensureIdWithPrefix,
    ensureIdWithNumSuffix,
    getStringifiedLiteral,
    shouldExtractCommonString
} from "../../../util/compiler/sundry"
import { CodeWriter } from "../writer"
import { CodeEditor } from "../editor"
import { transformTemplate } from "./template"
import { transformEmbeddedScript } from "./script"
import { generateTemplateFragments } from "./fragment"
import { arrayFrom } from "../../../util/shared/arrays"
import { traverseObject } from "../../../util/shared/sundry"
import { analyzeResult, inputDescriptor } from "../../state"
import { objectAssign, objectKeys, stringify } from "../../../util/shared/aliases"
import { findNonWhitespaceCharRight } from "../../../util/compiler/string"

export function generateRuntimeCode(nodes: TemplateNode[]) {
    let hasTopExtract = false
    let extractCommonStrCount = 0

    const { code: scriptSource, loc: scriptLoc } = inputDescriptor.script
    const { refs: defaultRefs, props: defaultProps } = analyzeResult.script.defaultItems

    objectAssign(analyzeResult.generateIds, {
        internal: ensureIdWithPrefix("_"),
        setterArg: ensureIdWithPrefix("v")
    })

    const writer = new CodeWriter(true)
    const hoistWriter = new CodeWriter()
    const anchorId = ensureIdWithPrefix("anchor")
    const contextId = ensureIdWithPrefix("context")
    const internalId = analyzeResult.generateIds.internal
    const componentName = inputDescriptor.options.componentName
    const embeddedScriptEditor = new CodeEditor(scriptSource, scriptLoc.start.index)

    for (const declaration of analyzeResult.script.importDeclarations) {
        writer.writeScriptNode(declaration.value).wrapLine()
    }
    writer.write(`import * as ${internalId} from "qingkuai/internal"`).wrapLine(2)

    // 重复使用的字符串字面量将被声明为常量，这里用于确定其标识符名称
    // Reused string literals will be declared as constants; this is used to determine their identifier names.
    traverseObject(analyzeResult.reusedStrings, (key, value) => {
        if (!shouldExtractCommonString(key)) {
            return
        }
        hasTopExtract = true
        value.id = ensureIdWithNumSuffix("_s", ++extractCommonStrCount)
        writer.write(`const ${value.id} = ${stringify(key)};`).wrapLine()
    })

    hasTopExtract && writer.wrapLine()
    generateTemplateFragments(nodes, writer)
    removeEliminatedNodes(embeddedScriptEditor)
    replaceStringLiterals(embeddedScriptEditor)
    transformEmbeddedScript(hoistWriter, embeddedScriptEditor)

    writer.write(`export default function ${componentName}(${anchorId}, ${contextId}) {`).indent()

    if (defaultRefs) {
        writer.write(`${contextId}.R = `).writeScriptNode(defaultRefs.value).wrapLine()
    }
    if (defaultProps) {
        writer.write(`${contextId}.P = `).writeScriptNode(defaultProps.value).wrapLine()
    }
    if (writeDelegateEventsRegistration(writer, contextId) || defaultRefs || defaultProps) {
        writer.wrapLine()
    }
    writer.write(`const { props, refs, slots } = ${internalId}.init(${contextId})`)
    hoistWriter.empty || writer.wrapLine().write(hoistWriter.code)
    writer.writeEditedScript(embeddedScriptEditor)
    transformTemplate(nodes, writer)
    writer.dedent().write("}")

    return (({ code, mappings }) => ({ code, mappings }))(writer)
}

export function removeEliminatedNodes(editor: CodeEditor) {
    const { eliminatedNodes } = analyzeResult.script
    const scriptSource = inputDescriptor.script.code
    const sortedEliminatedNodes = arrayFrom(eliminatedNodes).sort((a, b) => {
        return a.start! - b.start!
    })
    for (let i = 0, prevEnd = 0; i < sortedEliminatedNodes.length; i++) {
        const elininatedNode = sortedEliminatedNodes[i]
        const start = findNonWhitespaceCharRight(scriptSource, elininatedNode.start!)
        editor.remove(Math.max(prevEnd, start), (prevEnd = elininatedNode.end!))
    }
}

// 将需要委托的事件名称列表设置到 context.e
// Assign the list of event names that need to be delegated to `context.e`.
function writeDelegateEventsRegistration(writer: CodeWriter, contextId: string) {
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
    if (!passiveLen && !nonPassiveLen) {
        return false
    }

    const shouldWrapLine = passiveLen + nonPassiveLen > 8
    const seperator = ", " + (shouldWrapLine ? "\n" : "")
    const concatSeperatorCount = passiveLen ? (nonPassiveLen ? 2 : 1) : 0
    writer.write(`${contextId}.e = [`)
    shouldWrapLine && writer.indent()

    writer.write(nonPassiveEvents.join(seperator))
    writer.write(seperator.repeat(concatSeperatorCount))
    writer.write(passiveEvents.join(seperator))

    shouldWrapLine && writer.dedent()
    return (writer.write("]").wrapLine(), true)
}

function replaceStringLiterals(editor: CodeEditor) {
    if (!objectKeys(analyzeResult.reusedStrings).length) {
        return
    }
    for (const item of analyzeResult.script.stringLiterals) {
        if (analyzeResult.reusedStrings[item.value]) {
            editor.replace(...item.range!, analyzeResult.reusedStrings[item.value].id, true)
        }
    }
}
