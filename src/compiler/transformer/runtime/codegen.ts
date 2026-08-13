import type { GenerateIdentifier, TemplateNode } from "#type-declarations/compiler"

import { CodeEditor } from "../editor"
import { eliminate } from "../eliminate"
import { RuntimeCodeWriter } from "../writer"
import { transformEmbeddedScript } from "./script"
import { generateTemplateRender } from "./template"
import { replaceQkImportSpecifiers } from "./import"
import { objectAssign } from "../../../util/shared/aliases"
import { ensureIdWithPrefix } from "../../../util/compiler/sundry"
import { traverseObject, upperFirst } from "../../../util/shared/sundry"
import { analyzeResult, generateIdentifier, inputDescriptor } from "../../state"
import { getTemplateFragments, writeFragmentGetterDeclarations } from "./fragment"
import { writeStringLiteralsDeclarations, getMaybeReusedString } from "../../optimizer/compress"

export function generateRuntimeCode(nodes: TemplateNode[]) {
    const { code: scriptSource, loc: scriptLoc } = inputDescriptor.script
    const { usedIntrinsicVars, usedEffectWatchMethods } = analyzeResult.script

    objectAssign<GenerateIdentifier, Partial<GenerateIdentifier>>(generateIdentifier, {
        internal: ensureIdWithPrefix("_"),
        getterArg: ensureIdWithPrefix("_"),
        setterArg: ensureIdWithPrefix("v"),
        context: ensureIdWithPrefix("_ctx"),
        anchor: ensureIdWithPrefix("_anchor"),
        instance: ensureIdWithPrefix("_instance"),
        component: ensureIdWithPrefix("_component"),
        compressStrings: ensureIdWithPrefix("_compressStrings")
    })

    const writer = new RuntimeCodeWriter(true)
    const hoistWriter = new RuntimeCodeWriter()
    const anchorId = generateIdentifier.anchor
    const contextId = generateIdentifier.context
    const internalId = generateIdentifier.internal
    const templateFragments = getTemplateFragments(nodes)
    const embeddedScriptEditor = new CodeEditor(scriptSource, scriptLoc.start.index)

    replaceQkImportSpecifiers()

    for (const decl of analyzeResult.script.importDeclarations) {
        writer.writeScriptNode(decl).wrapLine()
    }
    eliminate(embeddedScriptEditor)
    writer.write(`import * as ${internalId} from "qingkuai/internal"`).wrapLine(2)
    writeStringLiteralsDeclarations(writer, templateFragments)
    writeFragmentGetterDeclarations(writer, templateFragments)
    transformEmbeddedScript(hoistWriter, embeddedScriptEditor)
    writer.write(`export default function (${anchorId}, ${contextId} = {}) {`).indent()

    const instanceId = generateIdentifier.instance
    if (!usedEffectWatchMethods.size && !analyzeResult.script.exportedBindings.length) {
        writer.write(`${internalId}.init(${anchorId}, ${contextId})`)
    } else {
        writer.write(`const ${instanceId} = ${internalId}.init(${anchorId}, ${contextId})`)
    }
    for (const method of ["props", "refs", "slots"]) {
        if (usedIntrinsicVars.has(method)) {
            writer.write(
                `\n\nconst ${method} = ${internalId}.init${upperFirst(method)}(${contextId})`
            )
        }
    }
    generateDelegateEventsRegistration(writer)

    if (!hoistWriter.empty) {
        writer.wrapLine().write(hoistWriter.code)
    }
    writer.writeEditedScript(embeddedScriptEditor)

    if (templateFragments.some(item => item.content.length)) {
        writer.wrapLine()
    }
    return (generateTemplateRender(writer, nodes), writer.dedent().write("}"))
}

// 生成委托事件的 initEvents 调用（内联事件数组，在 init 之后调用）
// Emit the delegated-event `initEvents` call with the inlined event array
// (invoked after `init`).
function generateDelegateEventsRegistration(writer: RuntimeCodeWriter) {
    const passiveEvents: string[] = []
    const nonPassiveEvents: string[] = []
    const { delegateEvents } = analyzeResult.template
    traverseObject(delegateEvents, (_, value, index) => {
        const container = index ? nonPassiveEvents : passiveEvents
        for (const item of value) {
            container.push(getMaybeReusedString(item))
        }
    })

    const passiveLen = passiveEvents.length
    const nonPassiveLen = nonPassiveEvents.length
    if (!passiveLen && !nonPassiveLen) {
        return
    }

    const shouldWrapLine = passiveLen + nonPassiveLen > 8
    const seperator = ", " + (shouldWrapLine ? "\n" : "")
    const concatSeperatorCount = passiveLen ? (nonPassiveLen ? 2 : 1) : 0
    writer.wrapLine().write(`${generateIdentifier.internal}.initEvents([`)

    if (shouldWrapLine) {
        writer.indent()
    }
    writer.write(nonPassiveEvents.join(seperator))
    writer.write(seperator.repeat(concatSeperatorCount))
    writer.write(passiveEvents.join(seperator))

    if (shouldWrapLine) {
        writer.dedent()
    }
    writer.write("])")
}
