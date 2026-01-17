import type { CompileOptions } from "#type-declarations/compiler"

import { resetCompilerState } from "./state"
import { analyzeScript } from "./analyzer/script"
import { parseTemplate } from "./parser/template"

export function compile(source: string, options: CompileOptions = {}) {
    resetCompilerState(options)
    parseTemplate(source)
    analyzeScript()
}
