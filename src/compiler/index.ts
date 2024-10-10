import {
    generateCompileResult,
    generateImportStatements,
    generateInitCallStatement
} from "./codegen"
import { parseTemplate } from "./parser/template"
import { analyzeScript } from "./analyzer/script"
import { analyzeTemplate } from "./analyzer/template"
import { transformScript } from "./transformer/script"
import { transformTemplate } from "./transformer/template"
import { inputDescriptor, resetCompilerState } from "./state"
import { compressCompileSize } from "./optimizer/compile-size"

export function compile(source: string, componentName: string) {
    const templateNodes = (resetCompilerState(), parseTemplate(source))
    const scriptSource = inputDescriptor.script.code
    analyzeScript(scriptSource)

    const templateAnalysisRet = analyzeTemplate(templateNodes)
    const scriptTranformedRet = transformScript(scriptSource, 1)
    compressCompileSize(templateAnalysisRet)

    // prettier-ignore
    const templateTransformedRet = transformTemplate(
        templateAnalysisRet,
        [inputDescriptor.script.lineCount, 0]
    )

    const importStatements = generateImportStatements()
    const initCallStatement = generateInitCallStatement()

    return generateCompileResult(
        componentName,
        importStatements,
        initCallStatement,
        scriptTranformedRet,
        templateTransformedRet
    )
}

export { isQimgKuaiCompileError } from "./message/error"
