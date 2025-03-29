import type {
    MessageItem,
    DebuggingInfo,
    SourceMapInfo,
    CompileOptions,
    StringConstant,
    EliminateRanges,
    ReplacementInfo,
    InputDescriptor,
    ScriptDescriptor,
    TempStoredImportInfo
} from "./types"

import { emptyArr } from "../util/shared/sundry"
import { newASTLocation } from "../util/compiler/structure"

// 在编译结果中返回的编译器内布值要打断其引用状态
export let messages: MessageItem[] = []
export let sourceMapInfo = newSourceMapInfo()
export let inputDescriptor = newInputDescriptor()

export const debuggingInfo = newDebuggingInfo()
export const replacementInfo = newReplacementInfo()

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
    allExistingIdentifiers.clear()
    stringConstantsSourceMap.clear()
    emptyArr(interCodeSnippets, tempStoredImportInfos)
    Object.assign(debuggingInfo, newDebuggingInfo())
    Object.assign(replacementInfo, newReplacementInfo())

    messages = []
    sourceMapInfo = newSourceMapInfo()
    inputDescriptor = newInputDescriptor()

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

export function newScriptDescriptor(): ScriptDescriptor {
    return {
        code: "",
        isTS: false,
        lineCount: 0,
        existing: false,
        loc: newASTLocation(),
        generatedOffset: [0, 0],
        startTagNameRange: [-1, -1]
    }
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
        source: "",
        slotInfo: {},
        positions: [],
        indentSpaceCount: 0,
        stringConstantCount: 0,
        options: {
            componentName: "",
            hashId: "",
            debug: false,
            check: false,
            sourcemap: false,
            typeRefStatement: "",
            reserveTemplateComment: false,
            convenientDerivedDeclaration: true
        },
        script: newScriptDescriptor()
    }
}
