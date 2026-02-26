import type { CompileOptions } from "#type-declarations/compiler"

import { inputDescriptor, resetCompilerState } from "./state"
import { analyzeScript } from "./analyzer/script"
import { parseTemplate } from "./parser/template"
import { analyzeTemplate } from "./analyzer/template"
import { generateRuntimeCode } from "./transformer/runtime/codegen"

export function compile(source: string, options: CompileOptions = {}) {
    const templateNodes = (resetCompilerState(options), parseTemplate(source))
    ;(analyzeScript(), analyzeTemplate(templateNodes))
    if (!inputDescriptor.options.checkMode) {
        return generateRuntimeCode(templateNodes)
    }
    return { code: "", mappings: [] }
}
