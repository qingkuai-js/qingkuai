import type {
    TemplateNode,
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

import { isUndefined } from "../util/shared/assert"
import { newASTLocation } from "../util/compiler/structure"

export let cacheId = 0
export const getCacheId = () => cacheId++

export let messages: MessageItem[] = []
export let sourceMapInfo = newSourceMapInfo()
export let inputDescriptor = newInputDescriptor()

export let debuggingInfo = newDebuggingInfo()
export let replacementInfo = newReplacementInfo()

export let interCodeSnippets: [number, string][] = []
export let tempStoredImportInfos: TempStoredImportInfo[] = []

export let usedInitItems = new Set<string>()
export let usedRuntimeItems = new Set<string>()
export let importedIdentifiers = new Set<string>()
export let allExistingIdentifiers = new Set<string>()
export let eliminateRanges: EliminateRanges = new Set()

export let aliases = new Map<string, string>()
export let stringConstants = new Map<string, StringConstant>()
export let stringConstantsSourceMap = new Map<string, string>()
export let templateNodeToContextIdentifiers = new WeakMap<TemplateNode, Set<string>>()

// 重置编译器状态
export function resetCompilerState(options: CompileOptions) {
    cacheId = 0
    messages = []
    interCodeSnippets = []
    tempStoredImportInfos = []
    debuggingInfo = newDebuggingInfo()
    sourceMapInfo = newSourceMapInfo()
    inputDescriptor = newInputDescriptor()
    replacementInfo = newReplacementInfo()

    aliases = new Map()
    usedInitItems = new Set()
    stringConstants = new Map()
    eliminateRanges = new Set()
    usedRuntimeItems = new Set()
    importedIdentifiers = new Set()
    allExistingIdentifiers = new Set()
    stringConstantsSourceMap = new Map()
    templateNodeToContextIdentifiers = new Map()

    // 调试模式下未指定是否生成sourcemap时默认生成sourcemap
    if (options.debug && isUndefined(options.sourcemap)) {
        options.sourcemap = true
    }

    // 检查模式下需要保留所有注释节点
    if (options.check) {
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

function newScriptDescriptor(): ScriptDescriptor {
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

// 生成一个新的输入源状态描述符
function newInputDescriptor(): InputDescriptor {
    return {
        source: "",
        styles: [],
        slotInfo: {},
        positions: [],
        indentSpaceCount: 0,
        stringConstantCount: 0,
        script: newScriptDescriptor(),
        options: {
            componentName: "",
            hashId: "",
            debug: false,
            check: false,
            comment: true,
            sourcemap: false,
            typeRefStatement: "",
            reserveTemplateComment: false,
            convenientDerivedDeclaration: true
        }
    }
}
