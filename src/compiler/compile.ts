import type { CompileOptions, CompileResult } from "#type-declarations/compiler"

import { analyzeScript } from "./analyzer/script"
import { parseTemplate } from "./parser/template"
import { encode } from "@jridgewell/sourcemap-codec"
import { analyzeTemplate } from "./analyzer/template"
import { generateRuntimeCode } from "./transformer/runtime/codegen"
import { inputDescriptor, messages, resetCompilerState } from "./state"

export function compile(source: string, options: CompileOptions = {}): CompileResult {
    const templateNodes = (resetCompilerState(options), parseTemplate(source))
    ;(analyzeScript(), analyzeTemplate(templateNodes))
    if (!inputDescriptor.options.checkMode) {
        const writer = generateRuntimeCode(templateNodes)
        return {
            interIndexMap: {
                itos: [],
                stoi: []
            },
            messages,
            templateNodes,
            inputDescriptor,
            code: writer.code,
            typeDeclarationLen: 0,
            hashId: options.hashId!,
            mappings: encode(writer.mappings)
        }
    }

    const writer = generateRuntimeCode(templateNodes)
    return {
        interIndexMap: {
            itos: [],
            stoi: []
        },
        messages,
        templateNodes,
        inputDescriptor,
        code: writer.code,
        typeDeclarationLen: 0,
        hashId: options.hashId!,
        mappings: encode(writer.mappings)
    }
}
