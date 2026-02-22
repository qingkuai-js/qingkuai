import type { CompileOptions } from "#type-declarations/compiler"

import { expect } from "vitest"
import { formatSourceCode } from "../../../src/util/testing/sundry"
import { CodeEditor } from "../../../src/compiler/transformer/editor"
import { CodeWriter } from "../../../src/compiler/transformer/writer"
import { parseTemplate } from "../../../src/compiler/parser/template"
import { analyzeScript } from "../../../src/compiler/analyzer/script"
import { analyzeTemplate } from "../../../src/compiler/analyzer/template"
import { transformEmbeddedScript } from "../../../src/compiler/transformer/runtime/script"
import { analyzeResult, inputDescriptor, resetCompilerState } from "../../../src/compiler/state"

export function matchTransformedScript(
    source: string,
    expected: string,
    options: CompileOptions = {}
) {
    const { hoist, edieted } = localTransform(source, options)
    expect(hoist ? `${hoist}\n${edieted}` : edieted).toBe(expected)
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
    analyzeResult.generateIds.internal = "_"
    analyzeResult.generateIds.setterArg = "v"
    transformEmbeddedScript(hoistEmbeddedScriptWriter, embeddedScriptEditor)

    return {
        edieted: formatSourceCode(embeddedScriptEditor.result),
        hoist: formatSourceCode(hoistEmbeddedScriptWriter.code)
    }
}
