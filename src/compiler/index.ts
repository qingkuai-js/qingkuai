import type { FixedArray } from "../util/types"

import {
    initItems,
    runtimeItems,
    sourceMapInfo,
    debuggingInfo,
    stringConstants,
    inputDescriptor,
    resetCompilerState,
    tempStoredImportInfos
} from "./state"
import { getAlias } from "./analyzer/alias"
import { indent } from "../util/compiler/state"
import { parseTemplate } from "./parser/template"
import { analyzeScript } from "./analyzer/script"
import { compilerOptions } from "./configuration"
import { offsetSourcemap } from "./sourcemap/tools"
import { encode } from "@jridgewell/sourcemap-codec"
import { analyzeTemplate } from "./analyzer/template"
import { transformScript } from "./transformer/script"
import { transformTemplate } from "./transformer/template"

export function compile(source: string, componentName: string) {
    const templateNodes = parseTemplate(source)
    const scriptSource = inputDescriptor.script.code
    analyzeScript(scriptSource)

    const templateAnalysisRet = analyzeTemplate(templateNodes)
    const scriptTranformedRet = transformScript(scriptSource, 1)
    const templateTransformedRet = transformTemplate(templateAnalysisRet, 0, 2)

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

// 生成runtime包导入项的import语句
function generateImportStatements() {
    let joinStr = ","
    let charCount = 0
    let runtimeStr = ""
    let itemArr: string[] = []
    let tempStoredImportStr = ""
    runtimeItems.forEach(item => {
        itemArr.push(item)
        charCount += item.length
    })
    itemArr.sort((a, b) => a.length - b.length)

    const itemStr = () => {
        return itemArr.join(joinStr)
    }

    if (charCount > 54) {
        joinStr += "\n" + indent()
        runtimeStr = `import {\n${indent()}${itemStr()}\n}`
        sourceMapInfo.preaddedLineCount += itemArr.length + 1
    } else {
        joinStr += " "
        runtimeStr = `import { ${itemStr()} }`
    }
    runtimeStr += ` from "qingkuai/internal"`
    sourceMapInfo.tempStoredImportStartLine = sourceMapInfo.preaddedLineCount + 1

    if (tempStoredImportInfos.length) {
        runtimeStr += "\n"
        tempStoredImportStr = tempStoredImportInfos.map(info => info.code).join("\n")
        sourceMapInfo.preaddedLineCount += (tempStoredImportStr.match(/\n/g)?.length || 0) + 1
    }

    return runtimeStr + tempStoredImportStr
}

// 生成init方法的调用及解构语句
function generateInitCallStatement() {
    const itemArr: string[] = []
    initItems.forEach(item => {
        itemArr.push(item)
    })
    itemArr.push("props", "refs")
    return `const { ${itemArr.join(", ")} } = ${getAlias("init")}(this)`
}

// 生成最终编译结果
function generateCompileResult(
    componentName: string,
    importStatements: string,
    initCallStatement: string,
    scriptTranformedRet: string,
    templateTransformedRet: string
) {
    let mappings = ""
    let debuggingStatementArr: string[] = []
    const isTS = inputDescriptor.script.isTS
    const setTemplateStructureFuncName = getAlias("setTemplateStructure")
    sourceMapInfo.columnOffsetOfFirstTemplateLine += inputDescriptor.indentSpaceCount * 2
    sourceMapInfo.columnOffsetOfFirstTemplateLine += setTemplateStructureFuncName.length + 2

    // 将保留的静态字符串字面量组合为变量声明语句
    const stringConstantArr: FixedArray<string, 2>[] = []
    stringConstants.forEach(({ value: variable, using }, literal) => {
        if (using) {
            stringConstantArr.push([variable, literal])
        }
    })

    const stringConstantStr = stringConstantArr.reduce((pre, [k, v], i) => {
        sourceMapInfo.preaddedLineCount += i === 0 ? 3 : 1
        return `${pre}\n${indent(2)}const ${k} = ${v}`
    }, "")
    if (compilerOptions.generateSourcemap) {
        offsetSourcemap()
        mappings = encode(sourceMapInfo.mappings)
    }

    const postfix = `\n\n${indent(2)}`
    const withStringConstant = stringConstantArr.length > 0
    const withScriptSourceCode = scriptTranformedRet !== ""
    const hasDebuggingSetter = debuggingInfo.setters.size > 0
    const stringConstantsPostfix = withStringConstant ? postfix : ""
    const hasNonBeCalledSetter = debuggingInfo.constIdentifiers.size > 0
    const scriptTransformedRetPostfix = withScriptSourceCode ? postfix : ""
    const stringLiteralComment = withStringConstant ? "// string literals area" : ""
    const scriptSourceComment = withScriptSourceCode ? "// javascript source code area\n" : ""

    if (hasDebuggingSetter || hasNonBeCalledSetter) {
        debuggingStatementArr.push(postfix, "// debugging setters area")
        debuggingInfo.setters.forEach((id, identifier) => {
            const setterFuncDeclaration = `function _d${id}_(v){ ${identifier} = v }`
            debuggingStatementArr.push(`\n${indent(2)}${setterFuncDeclaration}`)
        })
        if (hasNonBeCalledSetter) {
            debuggingStatementArr.push(`\n${indent(2)}function _dn_(){`)
            debuggingInfo.constIdentifiers.forEach(identifier => {
                debuggingStatementArr.push(` ${identifier};`)
            })
            debuggingStatementArr.push(" }")
        }
    }

    const code =
        `${importStatements}\n\nexport default class ${componentName} extends ` +
        `${getAlias("QingKuaiComponent")}{\n${indent(1)}constructor(args = {})` +
        `{\n${indent(2)}super(args)${postfix}${initCallStatement}${postfix}` +
        `${stringLiteralComment}${stringConstantStr}${stringConstantsPostfix}` +
        `${scriptSourceComment}${scriptTranformedRet}${scriptTransformedRetPostfix}` +
        `// template structure area\n${indent(2)}${setTemplateStructureFuncName}` +
        `(${templateTransformedRet})${debuggingStatementArr.join("")}` +
        `\n${indent(1)}}\n}`

    return resetCompilerState(), { code, mappings, isTS }
}
