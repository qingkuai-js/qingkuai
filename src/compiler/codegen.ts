import type { FixedArray } from "../util/types"

import {
    usedInitItems,
    sourceMapInfo,
    debuggingInfo,
    stringConstants,
    inputDescriptor,
    usedRuntimeItems,
    interCodeSnippets,
    tempStoredImportInfos
} from "./state"
import { getAlias } from "./analyzer/alias"
import { offsetSourcemap } from "./sourcemap"
import { indent } from "../util/compiler/sundry"
import { lastElem } from "../util/shared/sundry"
import { encode } from "@jridgewell/sourcemap-codec"
import { isEmptyString } from "../util/shared/assert"

// 生成runtime包导入项的import语句
export function generateImportStatements() {
    let joinStr = ","
    let charCount = 0
    let runtimeStr = ""
    let itemArr: string[] = []
    let tempStoredImportStr = ""
    usedRuntimeItems.forEach(item => {
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
export function generateInitCallStatement() {
    const itemArr: string[] = []
    usedInitItems.forEach(item => {
        itemArr.push(item)
    })
    itemArr.push("props")
    return `const { ${itemArr.join(", ")} } = ${getAlias("init")}(this)`
}

// 生成最终编译结果
export function generateCompileResult(
    componentName: string,
    importStatements: string,
    initCallStatement: string,
    scriptTranformedRet: string,
    templateTransformedRet: string
) {
    let mappings = ""
    let debuggingStatementArr: string[] = []
    const setTemplateStructureFuncName = getAlias("scts")
    const withScriptSourceCode = !isEmptyString(scriptTranformedRet)
    sourceMapInfo.columnOffsetOfFirstTemplateLine += inputDescriptor.indentSpaceCount * 2
    sourceMapInfo.columnOffsetOfFirstTemplateLine += setTemplateStructureFuncName.length + 2

    // 如果有<lang-js/ts>标签但生成代码中没有script部分，要将最后一行标记为删除
    if (!(sourceMapInfo.hasScript = withScriptSourceCode) && inputDescriptor.script.existing) {
        const { start: startLoc, end: endLoc } = inputDescriptor.script.loc
        sourceMapInfo.removedLine.add(endLoc.line - startLoc.line)
    }

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
    if (inputDescriptor.options.sourcemap) {
        offsetSourcemap()
        mappings = encode(sourceMapInfo.mappings)
    }

    const postfix = `\n\n${indent(2)}`
    const argsIdentifier = getAlias("args")
    const withStringConstant = stringConstantArr.length > 0
    const hasDebuggingSetter = debuggingInfo.setters.size > 0
    const stringConstantsPostfix = withStringConstant ? postfix : ""
    const hasNonBeCalledSetter = debuggingInfo.constIdentifiers.size > 0
    const scriptTransformedRetPostfix = withScriptSourceCode ? postfix : ""
    const stringLiteralComment = withStringConstant ? "// string literals area" : ""
    const scriptSourceComment = withScriptSourceCode ? "// javascript source code area\n" : ""

    if (hasDebuggingSetter || hasNonBeCalledSetter) {
        debuggingStatementArr.push(postfix, "// debugging setters area")
        debuggingInfo.setters.forEach((id, identifier) => {
            const setterFuncDeclaration = `function __d${id}__(v){ ${identifier} = v }`
            debuggingStatementArr.push(`\n${indent(2)}${setterFuncDeclaration}`)
        })
        if (hasNonBeCalledSetter) {
            debuggingStatementArr.push(`\n${indent(2)}function __dn__(){`)
            debuggingInfo.constIdentifiers.forEach(identifier => {
                debuggingStatementArr.push(` ${identifier};`)
            })
            debuggingStatementArr.push(" }")
        }
    }

    const code =
        `${importStatements}\n\nexport default class ${componentName} extends ` +
        `${getAlias("QingKuaiComponent")}{\n${indent(1)}constructor(${argsIdentifier})` +
        `{\n${indent(2)}super(${argsIdentifier})${postfix}${initCallStatement}${postfix}` +
        `${stringLiteralComment}${stringConstantStr}${stringConstantsPostfix}` +
        `${scriptSourceComment}${scriptTranformedRet}${scriptTransformedRetPostfix}` +
        `// template structure area\n${indent(2)}${setTemplateStructureFuncName}` +
        `(${templateTransformedRet || "[]"})${debuggingStatementArr.join("")}` +
        `\n${indent(1)}}\n}`

    return { code, mappings }
}

// 生成typescript语言服务可用的中间代码（包含双向索引映射）
export function generateIntermidiateResult(source: string, typeRefStatement: string) {
    const stoi: number[] = Array(source.length).fill(-1)
    const itos: number[] = Array(typeRefStatement.length).fill(-1)

    const snippetLen = interCodeSnippets.length
    const scriptSourceCode = inputDescriptor.script.code
    const scriptSourceCodeLen = scriptSourceCode.length
    const scriptSourceStartIndex = inputDescriptor.script.loc.start.index

    // 记录<lang-js>或<lang-ts>部分与中间代码的双向索引映射
    for (let i = 0; i < scriptSourceCodeLen; i++) {
        stoi[scriptSourceStartIndex + i] = itos.push(scriptSourceStartIndex + i) - 1
    }

    // 在script与template部分之间补一个分号避免语法错误
    itos.push(scriptSourceStartIndex + scriptSourceCodeLen)

    interCodeSnippets.forEach(([toi, tos], index) => {
        if (toi >= 0) {
            for (let i = 0; i < tos.length; i++) {
                stoi[toi + i] = itos.push(toi + i) - 2
            }
            return
        }

        let asasi = -1 // Added Snippet Applied Source Index

        // 中间代码片段中的第一个元素为-1/-2时代表需要在所有片段中向后/向前查找到首个
        // 有效的源码索引，此时中间代码片段的任意位置都映射到这个源码索引（结束位置需+1）
        if (toi === -1) {
            for (let i = index + 1; i < snippetLen; i++) {
                const si = interCodeSnippets[i]?.[0]
                if (si >= 0) {
                    asasi = si
                    break
                }
            }
        } else if (toi === -2) {
            asasi = itos.findLast(n => n >= 0) ?? -1
            asasi !== -1 && asasi++
        }
        for (let i = 0; i < tos.length; i++) {
            itos.push(asasi)
        }
    })

    const joinedSnippets = interCodeSnippets.map(item => item[1]).join("")
    const intermidiateCode = `${typeRefStatement}${scriptSourceCode};${joinedSnippets}`
    return {
        code: intermidiateCode,
        interIndexMap: {
            // 文件结束位置也需要记录双向索引映射
            // typescript语言服务会使用结束索引后2位
            stoi: [...stoi, lastElem(stoi)],
            itos: [...itos, lastElem(itos)]
        }
    }
}
