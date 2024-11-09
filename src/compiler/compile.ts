import type { CompileOptions, CompileResult } from "./types"

import {
    generateCompileResult,
    generateImportStatements,
    generateInitCallStatement,
    generateIntermidiateResult
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
    const componentName = options.componentName ?? "_"
    const scriptSourceCode = inputDescriptor.script.code
    const typeRefStatement = options.typeRefStatement ?? ""

    // 关于检查模式：检查模式表示仅用来检查编译错误的情况，这种情况下遇到编译错误时不会
    // 中断编译器的解析和执行，此时不会生成可运行的js代码，只会生成一种用来检查ts错误的
    // typescript中间代码，目前只有qingkuai语言服务器会在调用compile方法时使用该模式
    //
    // 检查模式下无需分析script代码，这样可以避免@babel/parser解析script代码的性能损耗，若需要
    // 诊断script部分的代码，typescript-qingkuai-plugin会复用vscode内置的typescript语言服务
    // 获取其AST进行诊断，诊断完成后会将诊断结果通过该插件独立启动的ipc服务器通知给qingkuai语言服务器
    if (!options.check) {
        analyzeScript(scriptSourceCode)
    }
    const templateAnalysisRet = analyzeTemplate(templateNodes)

    // 检查模式下无需执行转换操作，生成用于typescript语言服务的中间代码
    const basicResult = {
        messages,
        templateNodes,
        inputDescriptor,
        indexIsInScript: inputDescriptor.indexIsInScript
    }
    if (options.check) {
        return {
            mappings: "",
            ...basicResult,
            ...generateIntermidiateResult(source, typeRefStatement)
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
    return {
        interIndexMap: {
            stoi: [],
            itos: []
        },
        ...basicResult,
        ...generateCompileResult(
            componentName,
            importStatements,
            initCallStatement,
            scriptTranformedRet,
            templateTransformedRet
        )
    }
}
