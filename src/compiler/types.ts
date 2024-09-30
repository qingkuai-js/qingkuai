import type { FixedArray } from "../util/types"
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
    text: string | (() => string)
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
    type: "sfc" | "script"
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
    children: TemplateNode[]
    parent: TemplateNode | null
    range: FixedArray<number, 2>
    attributes: TemplateAttribute[]
}
export type FilteredTemplateAttribute = TemplateAttribute & {
    positionMap?: number[]
}

export interface TemplateAnalysisRet {
    tag: string
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
            to: string
            pto?: string
        }
    >
    count: number
}

export interface ValueWithLocation {
    value: string
    loc: ASTLocation
}
export interface AttributeAnalysisRet {
    directiveStu: TransformInterpolationRet[][]
    eventStu: TransformInterpolationRet[]
    attributeStu: TransformInterpolationRet[]
    insertNullNum?: number
    createTemplate?: boolean
    continueRE?: RegExp | null
    awaitContextStartIndex?: number
    continueArg?: string | undefined
    slotOfAnyTag: ValueWithLocation | null
    nameOfSlotTag?: ValueWithLocation | null
    shouldContinueDirective?: string | undefined
}

export interface TransformInterpolationOptionalParam {
    positionMap?: number[]
    usedAsSetter?: boolean
    isKeyDirective?: boolean
    eventWrapperFlag?: number
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
