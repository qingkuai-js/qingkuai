import type { TemplateNode } from "#type-declarations/compiler"
import type { SourceMapLine, SourceMapMappings } from "@jridgewell/sourcemap-codec"

import { analyzeResult, inputDescriptor } from "../../state"
import { getScriptLocByRange } from "../../../util/compiler/position"

export function generateRuntimeCode(nodes: TemplateNode[]) {
    const generatedLines: string[] = []
    const mappings: SourceMapMappings = []
    const _refsId = ensureIdentifierName("_refs")
    const _propsId = ensureIdentifierName("_props")
    const _slotsId = ensureIdentifierName("_slots")
    const targetId = ensureIdentifierName("target")
    const { componentName, sourcemap } = inputDescriptor.options
    const internalId = (analyzeResult.internalId = ensureIdentifierName("_"))

    const writeLine = (code: string, mapping: SourceMapLine = [], gap = false) => {
        if (sourcemap) {
            mappings.push(mapping)
            gap && mappings.push([])
        }
        generatedLines.push(code)
        gap && generatedLines.push("")
    }

    for (const declaration of analyzeResult.script.importDeclarations) {
        const range = declaration.value.range!
        const sourceLoc = getScriptLocByRange(range)
        const statement = inputDescriptor.script.code.slice(...range)
        writeLine(statement, [
            [0, 0, sourceLoc.start.line - 1, sourceLoc.start.column],
            [statement.length, 0, sourceLoc.end.line - 1, sourceLoc.end.column]
        ])
    }

    writeLine(`import * as ${internalId} from "qingkuai/internal";`, [], true)
    writeLine(
        `export default function ${componentName}(${targetId}, ${_propsId}, ${_refsId}, ${_slotsId}){`
    )
    writeLine(`    const refs = ${internalId}.initRefs(${_refsId})`)
    writeLine(`    const props = ${internalId}.initProps(${_propsId})`)
    writeLine(`    const slots = ${internalId}.initSlots(${_slotsId})`)
    writeLine(`}`)
    return generatedLines.join("\n")
}

function ensureIdentifierName(name: string) {
    for (let prefix = ""; true; prefix += "_") {
        if (!analyzeResult.script.fullIdentifiers.has(name)) {
            return name
        }
        name = prefix + name
    }
}
