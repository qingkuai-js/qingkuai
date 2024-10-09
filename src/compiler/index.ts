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
import { confirmStringConstants } from "./analyzer/string-constants"

export function compile(source: string, componentName: string) {
    const templateNodes = (resetCompilerState(), parseTemplate(source))
    const scriptSource = inputDescriptor.script.code
    analyzeScript(scriptSource)

    const templateAnalysisRet = analyzeTemplate(templateNodes)
    const scriptTranformedRet = transformScript(scriptSource, 1)
    confirmStringConstants(templateAnalysisRet)

    const templateTransformedRet = transformTemplate(
        templateAnalysisRet,
        inputDescriptor.script.lineCount
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
