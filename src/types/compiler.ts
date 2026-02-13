import type {
    Identifier,
    Expression,
    SpreadElement,
    StringLiteral,
    ImportDeclaration,
    VariableDeclarator,
    VariableDeclaration,
    TSImportEqualsDeclaration
} from "@babel/types"
import type {
    AnyNode,
    IntrinsicCall,
    ContextPattern,
    TopLevelDeclaratorNode,
    TopLevelDeclarationNode
} from "./estree"
import type { Pair } from "./tools"
import type { CompileError } from "../compiler/message/error"
import type { CompileWarning } from "../compiler/message/warn"
import type { WalkContext } from "../util/compiler/estree/walk"

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
    indent: string
    script: ScriptDescriptor
    styles: StyleDescriptor[]
    positions: ASTPositionWithFlag[]
    options: Required<CompileOptions>
}

export interface EditInsertSnippet {
    value: string
    sourceRange?: Range
}
export interface EditReplacement {
    removedLength?: number
    additions?: EditInsertSnippet[]
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
    commonStrings: Record<
        string,
        {
            id: string
            times: number
        }
    >
    generateIds: {
        internal: string
        setterArg: string
    }
    script: ScriptAnalyzeRet
    template: TemplateAnalyzeRet
    slots: Record<string, TemplateNode>
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
export interface TopLevelIdentifierInfo {
    nodeInfos: {
        id: Identifier
        declarator: TopLevelDeclaratorNode
        declaration: TopLevelDeclarationNode
        destructuringIdentifierNames?: string[]
    }[]
    path: string
    hoist: boolean
    implicit: boolean
    accessor: boolean
    status: IdentifierStatus
    destructuringIdentifierNames?: string[]
}
export interface TemplateAnalyzeRet {
    delegateEvents: {
        passive: Set<string>
        nonPassive: Set<string>
    }
    eventInfos: Map<
        TemplateAttribute,
        {
            eventName: string
            flagInfo: EventFlagInfo
        }
    >
    parsedExpressions: Map<
        any,
        {
            node: Expression
            startSourceIndex: number
            stringLiterals: StringLiteral[]
            topLevelReferences: TopLevelReferences
        }[]
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
    parsedPatterns: Map<TemplateAttribute, (ContextPattern | null)[] | undefined>
}
export interface ScriptAnalyzeRet {
    declaratorToAliasInfos: Map<
        VariableDeclarator,
        {
            target: string
            property: string
        }[]
    >
    defaultRefs?: {
        id: Identifier
        value: Expression | SpreadElement
    }
    defaultProps?: {
        id: Identifier
        value: Expression | SpreadElement
    }
    watchers: IntrinsicCall[]
    fullIdentifiers: Set<string>
    eliminateNodes: Set<AnyNode>
    stringLiterals: StringLiteral[]
    topLevelReferences: TopLevelReferences
    preMutatedTopLevelIdentifiers: Set<string>
    topLevelIdentifiers: Record<string, TopLevelIdentifierInfo>
    declaratorToIntrinsic: Map<VariableDeclarator, WalkContext<Identifier>>
    importDeclarations: WalkContext<ImportDeclaration | TSImportEqualsDeclaration>[]
}

export type Range = Pair<number>

export type TopLevelReferences = Record<
    string,
    {
        range: Range
        declared: boolean
        shorthand: boolean
    }[]
>

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
