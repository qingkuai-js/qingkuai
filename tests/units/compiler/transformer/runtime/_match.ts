import type { CompileOptions, TemplateNode } from "#type-declarations/compiler"

import { expect } from "vitest"
import {
    analyzeResult,
    inputDescriptor,
    generateIdentifier,
    resetCompilerState
} from "../../../../../src/compiler/state"
import {
    getTemplateFragments,
    writeFragmentGetterDeclarations
} from "../../../../../src/compiler/transformer/runtime/fragment"
import { isUndefined } from "../../../../../src/util/shared/assert"
import { formatSourceCode } from "../../../../../src/util/shared/sundry"
import { CodeEditor } from "../../../../../src/compiler/transformer/editor"
import { parseTemplate } from "../../../../../src/compiler/parser/template"
import { analyzeScript } from "../../../../../src/compiler/analyzer/script"
import { eliminate } from "../../../../../src/compiler/transformer/eliminate"
import { PARSER_TEMPLATE_OPTIONS } from "../../../../../src/compiler/constants"
import { analyzeTemplate } from "../../../../../src/compiler/analyzer/template"
import { RuntimeCodeWriter } from "../../../../../src/compiler/transformer/writer"
import { transformEmbeddedScript } from "../../../../../src/compiler/transformer/runtime/script"
import { writeStringLiteralsDeclarations } from "../../../../../src/compiler/optimizer/compress"

export function matchTransformedScript(
    source: string,
    expected: string,
    options: CompileOptions = {}
) {
    const { hoist, edieted } = localTransform(source, options)
    expect(hoist ? `${hoist}\n${edieted}` : edieted).toBe(expected)
}

export function matchGeneratedFragmentNonDebug(
    source: string,
    expected: string,
    options: CompileOptions = {}
) {
    if (isUndefined(options.debug)) {
        options.debug = false
    }
    return localMatchGeneratedFragment(source, expected, options)
}

export function matchGeneratedFragmentDebug(
    source: string,
    expected: string,
    options: CompileOptions = {}
) {
    if (isUndefined(options.debug)) {
        options.debug = true
    }
    return localMatchGeneratedFragment(source, expected, options)
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
    const hoistEmbeddedScriptWriter = new RuntimeCodeWriter()
    generateIdentifier.internal = "_"
    generateIdentifier.setterArg = "v"
    generateIdentifier.getterArg = "__"
    eliminate(embeddedScriptEditor)
    transformEmbeddedScript(hoistEmbeddedScriptWriter, embeddedScriptEditor)

    return {
        edieted: formatSourceCode(embeddedScriptEditor.result),
        hoist: formatSourceCode(hoistEmbeddedScriptWriter.code)
    }
}

function localMatchGeneratedFragment(source: string, expected: string, options: CompileOptions) {
    resetCompilerState(options)

    const writer = new RuntimeCodeWriter()
    const templateNodes = parseTemplate(source, PARSER_TEMPLATE_OPTIONS)
    ;(analyzeScript(), analyzeTemplate(templateNodes))
    generateIdentifier.internal = "_"
    generateIdentifier.compressStrings = "_compressStrings"

    const fragments = getTemplateFragments(templateNodes)
    writeStringLiteralsDeclarations(writer, fragments)
    writeFragmentGetterDeclarations(writer, fragments)
    expect(writer.code.trim()).toBe(formatSourceCode(expected))
    return templateNodes
}
