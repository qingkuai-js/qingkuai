import type {
    SpreadElement,
    Expression,
    ImportDeclaration,
    CallExpression,
    TSImportEqualsDeclaration
} from "@babel/types"
import type { Pair } from "./tools"
import type { CompileError } from "../compiler/message/error"
import type { CompileWarning } from "../compiler/message/warn"
import type { WalkContext } from "../util/compiler/estree/walk"
import type { ContextPattern, TopLevelDeclarationNode } from "./estree"

export interface ScriptDescriptor {
    code: string
    isTS: boolean
    loc: ASTLocation
    existing: boolean
    lineCount: number
    startTagOpenRange: Range
}
export interface StyleDescriptor {
    code: string
    lang: string
    loc: ASTLocation
    startTagOpenRange: Range
}
export interface InputDescriptor {
    source: string
    indent: number
    script: ScriptDescriptor
    styles: StyleDescriptor[]
    positions: ASTPositionWithFlag[]
    options: Required<CompileOptions>
}

export interface TextContentPart {
    value: string
    loc: ASTLocation
    isInterpolated: boolean
}
export interface AttributeNameValue {
    raw: string
    loc: ASTLocation
}
export interface TemplateAttribute {
    loc: ASTLocation
    equalSign: boolean
    name: AttributeNameValue
    value: AttributeNameValue
    valueEnclosure: AttributeValueEnclosure
}
export interface TemplateNode {
    tag: string
    loc: ASTLocation
    preWhiteSpace: boolean
    isEmbedded: boolean
    isSelfClosing: boolean
    componentTag: string
    children: TemplateNode[]
    content: TextContentPart[]
    startTagEndPos: ASTPosition
    endTagStartPos: ASTPosition
    prev: TemplateNode | null
    next: TemplateNode | null
    parent: TemplateNode | null
    attributes: TemplateAttribute[]
}

export interface CompileMessage {
    type: "error" | "warning"
    value: CompileError | CompileWarning
}

export interface ASTPosition {
    line: number
    column: number
    index: number
}
export interface ASTLocation {
    start: ASTPosition
    end: ASTPosition
}
export interface ASTPositionWithFlag extends ASTPosition {
    flag: number
}

export interface AnalyzeResult {
    script: ScriptAnalyzeRet
    template: TemplateAnalyzeRet
}
export interface EventFlagInfo {
    general: {
        value: number
        names: string[]
    }
    modifier: {
        value: number
        names: string[]
    }
}
export interface TemplateAnalyzeRet {
    eventInfos: Map<
        TemplateAttribute,
        {
            eventName: string
            flagInfo: EventFlagInfo
        }
    >
    nodeInfos: Map<
        TemplateNode,
        {
            contextIdentifiers: Set<string>
            sortedDirectives: TemplateAttribute[]
            attributesMap: Record<string, TemplateAttribute>
        }
    >
    validReferenceAttributes: Set<TemplateAttribute>
    parsedExpressions: Map<any, Expression | undefined>
    parsedPatterns: Map<TemplateAttribute, (ContextPattern | null)[] | undefined>
}
export interface ScriptAnalyzeRet {
    topLevelReferences: Record<
        string,
        {
            range: Range
            declared: boolean
            shorthand: boolean
        }[]
    >
    topLevelIdentifiers: Record<
        string,
        {
            range: Range
            path: string
            hoist: boolean
            implicit: boolean
            accessor: boolean
            status: IdentifierStatus
            contexts: WalkContext<TopLevelDeclarationNode>[]
        }
    >
    locations: Set<number>[]
    fullIdentifiers: Set<string>
    watchers: WalkContext<CallExpression>[]
    defaultRefs?: WalkContext<Expression | SpreadElement>
    defaultProps?: WalkContext<Expression | SpreadElement>
    importDeclarations: WalkContext<ImportDeclaration | TSImportEqualsDeclaration>[]
}

export type Range = Pair<number>

export type StandaloneParseOptions = Partial<{
    recover: boolean
    structureCheck: boolean
    reseveCommentNodes: boolean
}>

export type CompileOptions = Partial<{
    hashId: string
    debug: boolean
    sourcemap: boolean
    checkMode: boolean
    tipComment: boolean
    componentName: string
    typeImportStatement: string
    reserveCommentNodes: boolean
    checkTemplateStructure: boolean
    shorthandDerivedDeclaration: boolean
    reactivityMode: "reactive" | "shallow"
}>

export type IdentifierStatus =
    | "reactive"
    | "raw"
    | "shallow"
    | "derived"
    | "pending"
    | "alias"
    | "literal"
export type AttributeValueEnclosure = "single" | "double" | "curly" | "none"
export type ReactiveIntrinsics = "reactive" | "raw" | "shallow" | "derived" | "alias"
