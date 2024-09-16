import type {
    DebuggingInfo,
    SourceMapInfo,
    StringConstant,
    EliminateRanges,
    ReplacementInfo,
    InputDescriptor,
    TempStoredImportInfo
} from "./types"

import { setArrLength } from "../util/shared"
import { newASTLocation } from "../util/compiler/sundry"
import { SourceMapSegment } from "@jridgewell/sourcemap-codec"

export const sourceMapInfo = newSourceMapInfo()
export const debuggingInfo = newDebuggingInfo()
export const replacementInfo = newReplacementInfo()
export const inputDescriptor = newInputDescriptor()
export const tempStoredImportInfos: TempStoredImportInfo[] = []

export const initItems = new Set<string>()
export const runtimeItems = new Set<string>()
export const allExistingIdentifiers = new Set<string>()
export const eliminateRanges: EliminateRanges = new Set()

export const stringConstants = new Map<string, StringConstant>()
export const stringConstantsSourceMap = new Map<string, string>()

// 重置编译器状态
export function resetCompilerState() {
    initItems.clear()
    runtimeItems.clear()
    eliminateRanges.clear()
    stringConstants.clear()
    allExistingIdentifiers.clear()
    stringConstantsSourceMap.clear()
    setArrLength(tempStoredImportInfos, 0)
    Object.assign(sourceMapInfo, newSourceMapInfo())
    Object.assign(debuggingInfo, newDebuggingInfo())
    Object.assign(replacementInfo, newReplacementInfo())
    Object.assign(inputDescriptor, newInputDescriptor())
}

// 生成新的sourcemap信息结构
function newSourceMapInfo(): SourceMapInfo {
    return {
        mappings: [],
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
        type: "sfc",
        positions: [],
        indentSpaceCount: 0,
        script: {
            code: "",
            isTS: false,
            loc: newASTLocation(),
            generatedOffset: [0, 0],
            runtime: {
                namespaceIdentifier: "",
                watchIdentifiers: new Set()
            }
        }
    }
}
