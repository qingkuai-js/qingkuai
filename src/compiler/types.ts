import type { CompileError } from "./message/error"
import type { CompileWarning } from "./message/warn"
import type { FixedArray, NumNum } from "../util/types"
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

export type CompileOptions = Partial<{
    componentName: string
    hashId: string
    check: boolean
    debug: boolean
    comment: boolean
    sourcemap: boolean
    typeRefStatement: string
    reserveTemplateComment: boolean
    convenientDerivedDeclaration: boolean
}>

export interface CompileResult {
    code: string
    hashId: string
    mappings: string
    interIndexMap: {
        itos: number[]
        stoi: number[]
    }
    messages: MessageItem[]
    templateNodes: TemplateNode[]
    inputDescriptor: InputDescriptor
}

export interface InterAttributeRecord {
    value: string
    range: NumNum
    type: "key" | "value"
    specificRange: boolean
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
export interface ScriptDescriptor {
    code: string
    isTS: boolean
    lineCount: number
    loc: ASTLocation
    existing: boolean
    generatedOffset: NumNum
    startTagNameRange: NumNum
}
export interface StyleDescriptor {
    code: string
    lang: string
    loc: ASTLocation
    startTagNameRange: NumNum
}
export interface InputDescriptor {
    options: Required<CompileOptions>
    source: string
    slotInfo: SlotInfo
    indentSpaceCount: number
    script: ScriptDescriptor
    style: StyleDescriptor[]
    stringConstantCount: number
    positions: ASTPositionWithFlag[]
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
    quote: AttributeQuoteKinds
}
export interface TemplateNode {
    tag: string
    range: NumNum
    pure: boolean
    content: string
    loc: ASTLocation
    isEmbedded: boolean
    isSelfClosing: boolean
    preWhiteSpace: boolean
    componentTag: string
    children: TemplateNode[]
    startTagEndPos: ASTPosition
    endTagStartPos: ASTPosition
    parent: TemplateNode | null
    prev: TemplateNode | undefined
    next: TemplateNode | undefined
    attributes: TemplateAttribute[]
}
export type PreprocessedTemplateAttribute = TemplateAttribute & {
    inferredValue: string
    positionMap?: number[]
}

export interface TemplateAnalysisRet {
    tag: string
    cacheId: number
    isSpread: boolean
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

export interface AttributeAnalysisRet {
    directiveStu: TransformInterpolationRet[][]
    eventStu: TransformInterpolationRet[]
    attributeStu: TransformInterpolationRet[]
    continueInfo?: {
        re?: RegExp | null
        by?: string | undefined
        arg?: TransformInterpolationRet
    }
    slotOfAnyTag?: string
    nameOfSlotTag?: string
    insertNullNum?: number
    createSpread?: boolean
    contextBlockCount?: number
    componentCombinedArgs?: string[]
    awaitExpression?: [number, string]
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
    attributeWithNoValue?: boolean
}

export type TransformInterpolationRet =
    | string
    | {
          transformedExp: string
          mappings: FixedArray<number, 4>[]
      }

/**
 * - landingRnage表示报错/代码跳转的源码位置（slot标签无name属性时指向开始标签名）
 *
 * - properties中的三个元素分别表示：属性名称、属性名称源码范围、属性值在中间代码中的开始位置
 *   注意：第三个元素在分析阶段记录的是源码索引，在生成中间代码后才会通过源码索引换取中间代码索引
 *   当属性是一个HTML普通属性时，properties的第三个元素是一个字符串，值为属性值（静态字符串常量类型）
 *
 * - landingRange: indicates the source position for errors/code jumping, it will
 *   refs to the range of start tag name(<slot) when there is no name attribute.
 *
 * - properties: three of its elements are: attribute name, source range of attribute
 *   name, and the start index of attribute value in the intermidiate code.
 *   Note: the third element is the source code index during the analysis phase, which
 *   is exchanged for the intermidiate code index after the intermidiate code generated.
 *   When the attribute is normal, the third element of properties is a string with the
 *   value of attribute value(the static string constant type)
 */
export type SlotInfo = Record<
    string,
    {
        landingRange: NumNum
        properties: [string, NumNum, number | string][]
    }
>

export type EliminateRanges = Set<NumNum>
export type RegExpExecRet = ReturnType<RegExp["exec"]>
export type ReplacementStatus = "stc" | "pending" | "rea"
export type StringOrStringGetter = string | (() => string)
export type ASTPositionWithFlag = ASTPosition & { flag: number }
export type AttributeQuoteKinds = "single" | "double" | "curly" | "none"
