import type { CompileOptions, CompileResult } from "./types"

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
import { compressCompileSize } from "./optimizer/compile-size"
import { inputDescriptor, messages, resetCompilerState } from "./state"

export function compile(source: string, options: CompileOptions): CompileResult {
    resetCompilerState(options)

    const templateNodes = parseTemplate(source)
    const scriptSourceCode = inputDescriptor.script.code
    const templateAnalysisRet = (analyzeScript(scriptSourceCode), analyzeTemplate(templateNodes))

    // 检查模式下无需执行转换操作
    const basicRes = {
        messages,
        templateNodes,
        inputDescriptor
    }
    if (options.check) {
        return {
            ...basicRes,
            code: "",
            mappings: ""
        }
    }

    const scriptTranformedRet = transformScript(scriptSourceCode, 1)
    compressCompileSize(templateAnalysisRet)

    // prettier-ignore
    const templateTransformedRet = transformTemplate(
        templateAnalysisRet,
        [inputDescriptor.script.lineCount, 0]
    )
    const importStatements = generateImportStatements()
    const initCallStatement = generateInitCallStatement()

    const generateRes = generateCompileResult(
        options.componentName,
        importStatements,
        initCallStatement,
        scriptTranformedRet,
        templateTransformedRet
    )
    return { ...basicRes, ...generateRes }
}
