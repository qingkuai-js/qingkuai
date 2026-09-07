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
    const { usedIntrinsics } = analyzeResult.script
    const { code: scriptSource, loc: scriptLoc } = inputDescriptor.script

    objectAssign<GenerateIdentifier, Partial<GenerateIdentifier>>(generateIdentifier, {
        internal: ensureIdWithPrefix("_"),
        getterArg: ensureIdWithPrefix("_"),
        setterArg: ensureIdWithPrefix("v"),
        meta: ensureIdWithPrefix("_meta"),
        anchor: ensureIdWithPrefix("_anchor"),
        component: ensureIdWithPrefix("_component"),
        compressStrings: ensureIdWithPrefix("_compressStrings")
    })

    const writer = new RuntimeCodeWriter(true)
    const hoistWriter = new RuntimeCodeWriter()
    const metaId = generateIdentifier.meta
    const anchorId = generateIdentifier.anchor
    const internalId = generateIdentifier.internal
    const templateFragments = getTemplateFragments(nodes)
    const embeddedScriptEditor = new CodeEditor(scriptSource, scriptLoc.start.index)

    replaceQkImportSpecifiers()
    eliminate(embeddedScriptEditor)
    writer.write(`import * as ${internalId} from "qingkuai/internal"`).wrapLine(2)

    for (const decl of analyzeResult.script.importDeclarations) {
        writer.writeScriptNode(decl).wrapLine()
    }
    writeStringLiteralsDeclarations(writer, templateFragments)
    writeFragmentGetterDeclarations(writer, templateFragments)
    transformEmbeddedScript(hoistWriter, embeddedScriptEditor)
    writer.write(`export default function (${anchorId}, ${metaId} = {}) {`)
    writer.indent().write(`const instance = ${internalId}.init(${anchorId}, ${metaId})`)

    for (const id of ["props", "refs", "slots", "contexts"]) {
        if (usedIntrinsics.has(id)) {
            writer.write(`\nconst ${id} = ${internalId}.init${upperFirst(id)}(${metaId})`)
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
