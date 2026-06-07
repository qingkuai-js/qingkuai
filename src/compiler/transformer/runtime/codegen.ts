import type { GenerateIdentifier, TemplateNode } from "#type-declarations/compiler"

import { CodeEditor } from "../editor"
import { eliminate } from "../eliminate"
import { RuntimeCodeWriter } from "../writer"
import { transformEmbeddedScript } from "./script"
import { generateTemplateRender } from "./template"
import { arrayFrom } from "../../../util/shared/arrays"
import { objectAssign } from "../../../util/shared/aliases"
import { traverseObject } from "../../../util/shared/sundry"
import { ensureIdWithPrefix } from "../../../util/compiler/sundry"
import { analyzeResult, generateIdentifier, inputDescriptor } from "../../state"
import { getTemplateFragments, writeFragmentGetterDeclarations } from "./fragment"
import { writeStringLiteralsDeclarations, getMaybeReusedString } from "../../optimizer/compress"

export function generateRuntimeCode(nodes: TemplateNode[]) {
    const { usedIntrinsicVars } = analyzeResult.script
    const { code: scriptSource, loc: scriptLoc } = inputDescriptor.script
    const { refs: defaultRefs, props: defaultProps } = analyzeResult.script.defaultItems

    objectAssign<GenerateIdentifier, Partial<GenerateIdentifier>>(generateIdentifier, {
        internal: ensureIdWithPrefix("_"),
        getterArg: ensureIdWithPrefix("_"),
        setterArg: ensureIdWithPrefix("v"),
        context: ensureIdWithPrefix("_ctx"),
        anchor: ensureIdWithPrefix("_anchor"),
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

    for (const decl of analyzeResult.script.importDeclarations) {
        writer.writeScriptNode(decl).wrapLine()
    }
    eliminate(embeddedScriptEditor)
    writer.write(`import * as ${internalId} from "qingkuai/internal"`).wrapLine(2)
    writeStringLiteralsDeclarations(writer, templateFragments)
    writeFragmentGetterDeclarations(writer, templateFragments)
    transformEmbeddedScript(hoistWriter, embeddedScriptEditor)
    writer.write(`export default function (${anchorId}, ${contextId} = {}) {`).indent()

    if (defaultRefs) {
        writer.write(`${contextId}.R = `).writeScriptNode(defaultRefs.value).wrapLine()
    }
    if (defaultProps) {
        writer.write(`${contextId}.P = `).writeScriptNode(defaultProps.value).wrapLine()
    }
    generateDelegateEventsRegistration(writer, contextId)

    if (usedIntrinsicVars.size) {
        writer.write(`\nconst { ${arrayFrom(usedIntrinsicVars).join(", ")} } = `)
    }
    writer.write(`${internalId}.init(${contextId})`)

    if (!hoistWriter.empty) {
        writer.wrapLine().write(hoistWriter.code)
    }
    writer.writeEditedScript(embeddedScriptEditor)

    if (templateFragments.some(item => item.content.length)) {
        writer.wrapLine()
    }
    return (generateTemplateRender(writer, nodes), writer.dedent().write("}"))
}

// 将需要委托的事件名称列表设置到 context.e
// Assign the list of event names that need to be delegated to `context.e`.
function generateDelegateEventsRegistration(writer: RuntimeCodeWriter, contextId: string) {
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
        return false
    }

    const shouldWrapLine = passiveLen + nonPassiveLen > 8
    const seperator = ", " + (shouldWrapLine ? "\n" : "")
    const concatSeperatorCount = passiveLen ? (nonPassiveLen ? 2 : 1) : 0
    writer.write(`${contextId}.e = [`)

    if (shouldWrapLine) {
        writer.indent()
    }
    writer.write(nonPassiveEvents.join(seperator))
    writer.write(seperator.repeat(concatSeperatorCount))
    writer.write(passiveEvents.join(seperator))

    if (shouldWrapLine) {
        writer.dedent()
    }
    return (writer.write("]").wrapLine(), true)
}
