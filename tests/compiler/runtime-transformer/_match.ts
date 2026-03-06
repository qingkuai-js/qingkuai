import type { CompileOptions, TemplateNode } from "#type-declarations/compiler"

import { expect } from "vitest"
import {
    analyzeResult,
    inputDescriptor,
    generateIdentifier,
    resetCompilerState
} from "../../../src/compiler/state"
import {
    getTemplateFragments,
    generateTemplateFragments
} from "../../../src/compiler/transformer/runtime/fragment"
import { formatSourceCode } from "../../../src/util/testing/sundry"
import { CodeEditor } from "../../../src/compiler/transformer/editor"
import { CodeWriter } from "../../../src/compiler/transformer/writer"
import { parseTemplate } from "../../../src/compiler/parser/template"
import { analyzeScript } from "../../../src/compiler/analyzer/script"
import { analyzeTemplate } from "../../../src/compiler/analyzer/template"
import { removeEliminatedNodes } from "../../../src/compiler/transformer/runtime/codegen"
import { transformEmbeddedScript } from "../../../src/compiler/transformer/runtime/script"

export function matchTransformedScript(
    source: string,
    expected: string,
    options: CompileOptions = {}
) {
    const { hoist, edieted } = localTransform(source, options)
    expect(hoist ? `${hoist}\n${edieted}` : edieted).toBe(expected)
}

export function matchGeneratedFragment(
    source: string,
    expected: string,
    options: CompileOptions = {}
) {
    resetCompilerState(options)

    const writer = new CodeWriter()
    const templateNodes = parseTemplate(source)
    generateIdentifier.internal = "_"
    ;(analyzeScript(), analyzeTemplate(templateNodes))
    generateTemplateFragments(getTemplateFragments(templateNodes), writer)
    expect(writer.code.trim()).toBe(formatSourceCode(expected))
    return templateNodes
}

export function matchTemplateNodesRuntimeId(data: [TemplateNode, string][]) {
    for (const [node, id] of data) {
        expect(analyzeResult.template.nodeContexts.get(node)?.id).toBe(id)
    }
}

export function matchTemplateNodesAnchorId(data: [TemplateNode, string][]) {
    for (const [node, id] of data) {
        expect(analyzeResult.template.nodeContexts.get(node)?.anchorId).toBe(id)
    }
}

function localTransform(source: string, options: CompileOptions) {
    const templateNodes = (resetCompilerState(options), parseTemplate(formatSourceCode(source)))
    ;(analyzeScript(), analyzeTemplate(templateNodes))

    const scriptDescriptor = inputDescriptor.script
    const embeddedScriptEditor = new CodeEditor(
        scriptDescriptor.code,
        scriptDescriptor.loc.start.index
    )
    const hoistEmbeddedScriptWriter = new CodeWriter()
    generateIdentifier.internal = "_"
    generateIdentifier.setterArg = "v"
    removeEliminatedNodes(embeddedScriptEditor)
    transformEmbeddedScript(hoistEmbeddedScriptWriter, embeddedScriptEditor)

    return {
        edieted: formatSourceCode(embeddedScriptEditor.result),
        hoist: formatSourceCode(hoistEmbeddedScriptWriter.code)
    }
}
