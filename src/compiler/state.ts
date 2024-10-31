import type {
    MessageItem,
    DebuggingInfo,
    SourceMapInfo,
    CompileOptions,
    StringConstant,
    EliminateRanges,
    ReplacementInfo,
    InputDescriptor,
    TempStoredImportInfo
} from "./types"

import { setArrLength } from "../util/shared/sundry"
import { newASTLocation } from "../util/compiler/structure"

export const sourceMapInfo = newSourceMapInfo()
export const debuggingInfo = newDebuggingInfo()
export const replacementInfo = newReplacementInfo()
export const inputDescriptor = newInputDescriptor()

export const messages: MessageItem[] = []
export const interCodeSnippets: [number, string][] = []
export const tempStoredImportInfos: TempStoredImportInfo[] = []

export const usedInitItems = new Set<string>()
export const usedRuntimeItems = new Set<string>()
export const allExistingIdentifiers = new Set<string>()
export const eliminateRanges: EliminateRanges = new Set()

export const stringConstants = new Map<string, StringConstant>()
export const stringConstantsSourceMap = new Map<string, string>()

// 重置编译器状态
export function resetCompilerState(options: CompileOptions) {
    usedInitItems.clear()
    eliminateRanges.clear()
    stringConstants.clear()
    usedRuntimeItems.clear()
    setArrLength(messages, 0)
    allExistingIdentifiers.clear()
    stringConstantsSourceMap.clear()
    setArrLength(interCodeSnippets, 0)
    setArrLength(tempStoredImportInfos, 0)
    Object.assign(sourceMapInfo, newSourceMapInfo())
    Object.assign(debuggingInfo, newDebuggingInfo())
    Object.assign(replacementInfo, newReplacementInfo())
    Object.assign(inputDescriptor, newInputDescriptor())

    // 调试模式下一定会生成sourcemap
    if (options.debug === true) {
        options.sourcemap = true
    }
    // 检查模式下需要保留所有注释节点
    if (options.check === true) {
        options.reserveTemplateComment = true
    }
    Object.assign(inputDescriptor.options, options)
}

// 生成新的sourcemap信息结构
function newSourceMapInfo(): SourceMapInfo {
    return {
        mappings: [],
        hasScript: false,
        preaddedLineCount: 0,
        removedLine: new Set(),
        tempStoredImportStartLine: 0,
        positionShouldNotBeMapped: [],
        existingSourceIndex: new Set(),
        columnOffsetOfFirstTemplateLine: 0
    }
}

// 生成新的调试信息结构
function newDebuggingInfo(): DebuggingInfo {
    return {
        setters: new Map(),
        constIdentifiers: new Set()
    }
}

// 生成新的文本替换信息解构
function newReplacementInfo(): ReplacementInfo {
    return {
        count: 0,
        map: new Map()
    }
}

// 生成一个新的输入源状态描述符
function newInputDescriptor(): InputDescriptor {
    return {
        positions: [],
        indexIsInScript: [],
        indentSpaceCount: 0,
        stringConstantCount: 0,
        options: {
            componentName: "",
            debug: false,
            check: false,
            sourcemap: false,
            reserveTemplateComment: false
        },
        script: {
            code: "",
            isTS: false,
            lineCount: 0,
            existing: false,
            loc: newASTLocation(),
            generatedOffset: [0, 0],
            runtime: {
                namespaceIdentifier: "",
                watchIdentifiers: new Set()
            }
        }
    }
}
