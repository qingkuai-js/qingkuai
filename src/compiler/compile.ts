import type { CompileOptions } from "#type-declarations/compiler"

import { resetCompilerState } from "./state"
import { analyzeScript } from "./analyzer/script"
import { parseTemplate } from "./parser/template"
import { analyzeTemplate } from "./analyzer/template"

export function compile(source: string, options: CompileOptions = {}) {
    const templateNodes = (resetCompilerState(options), parseTemplate(source))
    analyzeScript(), analyzeTemplate(templateNodes)
}
