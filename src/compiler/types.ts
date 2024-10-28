import type { FixedArray } from "../util/types"
import type { CompileError } from "./message/error"
import type { CompileWarning } from "./message/warn"
import type { SourceMapLine, SourceMapMappings } from "@jridgewell/sourcemap-codec"

export interface ASTPosition {
    line: number
    column: number
    index: number
}
export interface ASTLocation {
    start: ASTPosition
    end: ASTPosition
}

export interface CompileOptions {
    componentName: string
    check?: boolean
    debug?: boolean
    sourcemap?: boolean
    reserveTemplateComment?: boolean
}

export interface CompileResult {
    code: string
    mappings: string
    messages: MessageItem[]
    templateNodes: TemplateNode[]
    inputDescriptor: InputDescriptor
}

export interface SourceMapInfo {
    mappings: SourceMapMappings
    hasScript: boolean
    preaddedLineCount: number
    removedLine: Set<number>
    existingSourceIndex: Set<number>
    tempStoredImportStartLine: number
    columnOffsetOfFirstTemplateLine: number
    positionShouldNotBeMapped: (boolean | undefined)[]
}
export interface StringConstant {
    value: string
    count: number
    using: boolean
}
export interface ReplacementItem {
    id: number
    order: number
    processed: boolean
    index: number
    text: StringOrStringGetter
}
export type ReplacementMap = Map<
    string,
    {
        useDollar: boolean
        createSetter: boolean
        items: ReplacementItem[]
        status: ReplacementStatus
    }
>
export interface ReplacementInfo {
    count: number
    map: ReplacementMap
}
export interface DebuggingInfo {
    setters: Map<string, number>
    constIdentifiers: Set<string>
}
export interface TempStoredImportInfo {
    code: string
    startColumn: number
    mappingLine: SourceMapLine
}
export interface InputDescriptor {
    options: Required<CompileOptions>
    indentSpaceCount: number
    positions: ASTPosition[]
    stringConstantCount: number
    script: {
        code: string
        isTS: boolean
        lineCount: number
        loc: ASTLocation
        existing: boolean
        runtime: {
            namespaceIdentifier: string
            watchIdentifiers: Set<string>
        }
        generatedOffset: FixedArray<number, 2>
    }
}

export type MessageItem =
    | {
          type: "error"
          value: CompileError
      }
    | {
          type: "warning"
          value: CompileWarning
      }

export interface AttributeKeyValue {
    raw: string
    loc: ASTLocation
}
export interface TemplateAttribute {
    loc: ASTLocation
    key: AttributeKeyValue
    value: AttributeKeyValue
}
export interface TemplateNode {
    tag: string
    content: string
    loc: ASTLocation
    isEmbedded: boolean
    isComponent: boolean
    children: TemplateNode[]
    startTagEndPos: ASTPosition
    endTagStartPos: ASTPosition
    parent: TemplateNode | null
    range: FixedArray<number, 2>
    attributes: TemplateAttribute[]
}
export type FilteredTemplateAttribute = TemplateAttribute & {
    positionMap?: number[]
}

export interface TemplateAnalysisRet {
    tag: string
    isTemplate: boolean
    content: TransformInterpolationRet
    children: {
        useBracket: boolean
        tar: TemplateAnalysisRet | null
    }[]

    // means Analysis Attribute Ret
    aar: AttributeAnalysisRet | null
}

export type TemplateContext = {
    map: Map<
        string,
        {
            num: number
            path: string
        }
    >
    count: number
}

export interface ValueWithLocation<T> {
    value: T
    loc: ASTLocation
}
export interface AttributeAnalysisRet {
    directiveStu: TransformInterpolationRet[][]
    eventStu: TransformInterpolationRet[]
    attributeStu: TransformInterpolationRet[]
    continueInfo?: {
        re?: RegExp | null
        by?: string | undefined
        arg?: TransformInterpolationRet
    }
    insertNullNum?: number
    createTemplate?: boolean
    awaitContextStartIndex?: number
    slotOfAnyTag: ValueWithLocation<string> | null
    nameOfSlotTag?: ValueWithLocation<string> | null
}

export interface TransformInterpolationOptionalParam {
    eventWrapper?: {
        flag: number
        modifiers: string[]
    }
    positionMap?: number[]
    usedAsSetter?: boolean
    isKeyDirective?: boolean
    isComponentEvent?: boolean
}

export type TransformInterpolationRet =
    | string
    | {
          transformedExp: string
          mappings: FixedArray<number, 4>[]
      }

export type RegExpExecRet = ReturnType<RegExp["exec"]>
export type EliminateRanges = Set<FixedArray<number, 2>>
export type ReplacementStatus = "stc" | "pending" | "rea"
export type StringOrStringGetter = string | (() => string)
