import { analyzeScript } from "./analyzer/script"
import { parseTemplate } from "./parser/template"
import { resetCompilerState } from "./state"

export function compile(source: string) {
    resetCompilerState({})
    parseTemplate(source)
    analyzeScript()
}
