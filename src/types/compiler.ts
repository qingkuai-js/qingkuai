import type { Pair } from "./tools"
import type { TopLevelDeclarationNode } from "./estree"
import type { CompileError } from "../compiler/message/error"
import type { CompileWarning } from "../compiler/message/warn"
import type { WalkContext } from "../util/compiler/estree/walk"
import type { SpreadElement, Expression, ImportDeclaration, CallExpression } from "@babel/types"

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
export interface AttributeKeyValue {
    raw: string
    loc: ASTLocation
}
export interface TemplateAttribute {
    loc: ASTLocation
    key: AttributeKeyValue
    value: AttributeKeyValue
    quote: AttributeQuoteKind
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
export type ASTPositionWithFlag = ASTPosition & {
    flag: number
}

export interface AnalyzeResult {
    script: ScriptAnalyzeRet
}

export interface ScriptAnalyzeRet {
    topLevelReferences: Map<
        string,
        {
            range: Range
            declared: boolean
            shorthand: boolean
        }[]
    >
    topLevelIdentifiers: Map<
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
    fullIdentifiers: Set<string>
    watchers: WalkContext<CallExpression>[]
    importDeclarations: WalkContext<ImportDeclaration>[]
    defaultRefs?: WalkContext<Expression | SpreadElement>
    defaultProps?: WalkContext<Expression | SpreadElement>
}

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
}>

export type Range = Pair<number>
export type AttributeQuoteKind = "single" | "double" | "curly" | "none"
export type IdentifierStatus = "reactive" | "raw" | "shallow" | "derived" | "pending" | "alias"
