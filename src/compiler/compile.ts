import type { CompileOptions, CompileResult } from "./types"

import { isString } from "../util/shared/assert"
import { parseTemplate } from "./parser/template"
import { analyzeScript } from "./analyzer/script"
import { analyzeTemplate } from "./analyzer/template"
import { createHashId } from "../util/compiler/sundry"
import { transformScript } from "./transformer/script"
import { transformTemplate } from "./transformer/template"
import { compressCompileSize } from "./optimizer/compile-size"
import { generateInterResult, generateCompileResult } from "./codegen"
import { inputDescriptor, messages, resetCompilerState } from "./state"

export function compile(source: string, options: CompileOptions): CompileResult {
    resetCompilerState(options)
    inputDescriptor.source = source

    const templateNodes = parseTemplate(source)
    const hashId = options.hashId || createHashId()
    const componentName = options.componentName ?? "_"
    const scriptSourceCode = inputDescriptor.script.code
    const typeRefStatement = options.typeRefStatement ?? ""

    // 关于检查模式：检查模式表示仅用来检查编译错误的情况，这种情况下遇到编译错误时不会
    // 中断编译器的解析和执行，此时不会生成可运行的js代码，只会生成一种用来检查ts错误的
    // typescript中间代码，目前只有qingkuai语言服务器会在调用compile方法时使用该模式
    //
    // 检查模式下无需分析script代码，这样可以避免@babel/parser解析script代码的性能损耗，若需要
    // 诊断script部分的代码，typescript-qingkuai-plugin会复用vscode内置的typescript语言服务的
    // SourceFile AST进行诊断，诊断完成后会将诊断结果通过该插件独立启动的ipc服务器通知给qingkuai语言服务器
    if (!options.check) {
        analyzeScript(scriptSourceCode)
    }

    // 分析模板部分的代码，非检查模式下它需要在分析完脚本代码之后执行
    const templateAnalysisRet = analyzeTemplate(templateNodes)

    // 检查模式下仅生成用于js/ts语言服务的中间代码，无需执行正常编译模式的转换操作
    const basicResult = {
        hashId,
        messages,
        templateNodes,
        inputDescriptor,
        typeDeclarationLen: 0
    }
    if (options.check) {
        const ret = exchangeInterIndexOfSlotInfo({
            mappings: "",
            ...basicResult,
            ...generateInterResult(source, typeRefStatement)
        })
        console.log(ret)
        return ret
    }

    // 转换脚本代码并确定编译结果中可压缩代码体积的地方（相同字符串、冗余字符等）
    const scriptTranformedRet = transformScript(scriptSourceCode, 1)
    compressCompileSize(templateAnalysisRet)

    return {
        interIndexMap: {
            stoi: [],
            itos: []
        },
        ...basicResult,
        ...generateCompileResult(
            hashId,
            componentName,
            scriptTranformedRet,
            transformTemplate(templateAnalysisRet, [inputDescriptor.script.lineCount, 0])
        )
    }
}

// 将slotInfo-properties中每项的第三个元素（源码索引）转换为中间代码索引，参考: file://./types.ts
function exchangeInterIndexOfSlotInfo(interCompileRes: CompileResult) {
    const { slotInfo } = inputDescriptor
    const { stoi } = interCompileRes.interIndexMap
    Object.keys(slotInfo).forEach(slotName => {
        slotInfo[slotName].properties.forEach(property => {
            !isString(property[2]) && (property[2] = stoi[property[2]])
        })
    })
    return interCompileRes
}
