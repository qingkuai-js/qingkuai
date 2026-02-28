import type {
    Identifier,
    Expression,
    SpreadElement,
    StringLiteral,
    ImportDeclaration,
    VariableDeclarator,
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
import type { WalkContext } from "../compiler/estree/walk"
import type { CompileError } from "../compiler/message/error"
import type { CompileWarning } from "../compiler/message/warn"

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

export interface TemplateFragment {
    id: string
    content: string
    getterId: string
    statements: string[]
    usedCompressString: boolean
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
    componentTag: string
    isEmbedded: boolean
    preWhiteSpace: boolean
    isSelfClosing: boolean
    hasInterpolation: boolean
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
    reusedStrings: Record<
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
export interface TemplateNodeContext {
    id: string
    anchorId: string
    contextIdentifiers: Set<string>
    fragment: TemplateFragment | null
    sortedDirectives: TemplateAttribute[]
    attributesMap: Record<string, TemplateAttribute>
}
export interface TemplateAnalyzeRet {
    compressStrings: Record<
        string,
        {
            id: string
            times: number
        }
    >
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
    compressStringsCount: number
    staticTextContents: Map<TextContentPart, string>
    validReferenceAttributes: Set<TemplateAttribute>
    nodeContexts: Map<TemplateNode, TemplateNodeContext>
    parsedPatterns: Map<TemplateAttribute, (ContextPattern | null)[] | undefined>
}
export interface ScriptAnalyzeRet {
    declaratorToAliasInfos: Map<
        VariableDeclarator,
        {
            id: string
            target: string
            property: string
        }[]
    >
    defaultItems: Partial<
        Record<
            "refs" | "props",
            {
                intrinsicId: Identifier
                value: Expression | SpreadElement
            }
        >
    >
    watchers: IntrinsicCall[]
    fullIdentifiers: Set<string>
    eliminatedNodes: Set<AnyNode>
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
    preserveCommentNodes: boolean
    checkTemplateStructure: boolean
    shorthandDerivedDeclaration: boolean
    reactivityMode: "reactive" | "shallow"
    whitespace: "preserve" | "trim" | "collapse" | "trim-collapse"
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
