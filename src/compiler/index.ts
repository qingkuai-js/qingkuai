import {
    generateCompileResult,
    generateImportStatements,
    generateInitCallStatement
} from "./codegen"
import { parseTemplate } from "./parser/template"
import { analyzeScript } from "./analyzer/script"
import { compilerOptions } from "./configuration"
import { analyzeTemplate } from "./analyzer/template"
import { transformScript } from "./transformer/script"
import { transformTemplate } from "./transformer/template"
import { compressCompileSize } from "./optimizer/compile-size"
import { confirmQingKuaiIdentifierAliases } from "./analyzer/alias"
import { inputDescriptor, messages, resetCompilerState } from "./state"

export function compile(source: string, componentName: string) {
    const templateNodes = (resetCompilerState(), parseTemplate(source))
    const scriptSource = inputDescriptor.script.code
    analyzeScript(scriptSource)

    const templateAnalysisRet = analyzeTemplate(templateNodes)
    confirmQingKuaiIdentifierAliases()

    // 检查模式下无需执行转换操作
    if (compilerOptions.checkMode) {
        return {
            messages,
            code: "",
            mappings: "",
            isTs: inputDescriptor.script.isTS
        }
    }

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

export { isCompileError } from "./message/error"
