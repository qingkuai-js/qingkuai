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
} from "#type-declarations/estree"
import type { Pair } from "#type-declarations/tools"

export interface CompileWarning {
    loc: ASTLocation
    code: number
    message: string
}
export interface CompileError extends Error {
    code: number
    loc: ASTLocation
    description: string
}

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
    options: InputOptions
    script: ScriptDescriptor
    styles: StyleDescriptor[]
    positions: ASTPositionWithFlag[]
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
    selections: {
        id: string
        index: number
        replaceWithText: boolean
        parent: string | undefined
    }[]
    id: string
    getterId: string
    content: string[]
    usedCompressString: boolean
    directChildrenCount: number
    getWith: TemplateFragment | undefined
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
    rawTag: string
    loc: ASTLocation
    componentTag: string
    isEmbedded: boolean
    preWhiteSpace: boolean
    isSelfClosing: boolean
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

export interface GenerateIdentifier {
    suffix: Record<
        string,
        {
            last: number
            originUsed: boolean
        }
    >
    anchor: string
    context: string
    internal: string
    getterArg: string
    setterArg: string
    contextGetter: string
    prefix: Record<string, number>
}

export interface AnalyzeResult {
    reusedStrings: Record<
        string,
        {
            id: string
            times: number
        }
    >
    script: ScriptAnalyzeRet
    template: TemplateAnalyzeRet
}
export interface EventFlagInfo {
    value: number
    items: {
        name: string
        sourceRange: Range
    }[]
}
export interface ComponentTagPart {
    id: string
    sourceRange: Range
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
    transofrmedTo: string
    status: IdentifierStatus
    destructuringIdentifierNames?: string[]
}
export interface TemplateNodeContext {
    id: string
    anchorId: string
    node: TemplateNode
    shouldBeSelected: boolean
    selectableChildCount: number
    contextIdentifiers: Set<string>
    fragment: TemplateFragment | null
    eventListeners: TemplateAttribute[]
    sortedDirectives: TemplateAttribute[]
    staticAttributes: TemplateAttribute[]
    dynamicAttributes: TemplateAttribute[]
    referenceAttributes: TemplateAttribute[]
    attributesMap: Record<string, TemplateAttribute>
}
export interface TemplateAnalyzeRet {
    compressStrings: Record<
        string,
        {
            index: number
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
            generalFlag: EventFlagInfo
            wrapperFlag: EventFlagInfo
        }
    >
    directiveIndos: Map<
        TemplateAttribute,
        {
            base: string
            keywordIndex: number
            baseStartSourceIndex: number
        }
    >
    parsedExpressions: Map<
        any,
        {
            source: string
            node: Expression
            reactive: boolean
            startSourceIndex: number
            stringLiterals: StringLiteral[]
            topLevelReferences: TopLevelReferences
        }
    >
    compressStringsCount: number
    slots: Record<string, TemplateNode>
    componentFragment: TemplateFragment | null
    staticTextContents: Map<TextContentPart, string>
    validReferenceAttributes: Set<TemplateAttribute>
    nodeContexts: Map<TemplateNode, TemplateNodeContext>
    parsedComponentTags: Map<TemplateNode, ComponentTagPart[]>
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
    declaratorToIntrinsic: Map<VariableDeclarator, EstreeWalkContext<Identifier>>
    importDeclarations: EstreeWalkContext<ImportDeclaration | TSImportEqualsDeclaration>[]
}

export interface EstreeWalkContext<T extends AnyNode = AnyNode> {
    value: T
    inTopLevel: boolean
    isScopeBoundary: boolean
    isBindingReference: boolean
    inHoistableTopLevel: boolean
    isComputedIdentifier: boolean
    isParameterIdentifier: boolean
    isShorthandIdentifierAccess: boolean
    isNonHoistableScopeBoundary: boolean
    isIdentifierAssignmentTarget: boolean
    scopeIdentifiers: Set<string> | undefined
    scope: EstreeWalkContext | null
    parent: EstreeWalkContext | null
    nonHoistableScope: EstreeWalkContext | null
    striptTypeOperationsParent: EstreeWalkContext | null
    findAncestorUntil: <T extends AnyNode["type"]>(
        type: T
    ) => EstreeWalkContext<AnyNode & { type: T }> | null
    walkAncestors: (callback: (context: EstreeWalkContext) => void) => void
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
    preseveCommentNodes: boolean
    preserveBlankTextNodes: boolean
    checkTemplateStructure: boolean
    checkEmptyInterpolation: boolean
    checkAttributeValueEnclosure: boolean
}>

export interface CompileIntermediateOptions {
    typeDeclarationFilePath: string
    shorthandDerivedDeclaration?: boolean
}

export interface CompileResult {
    code: string
    hashId: string
    mappings: string
    styles: StyleDescriptor[]
}

export type CompileOptions = Partial<{
    hashId: string
    debug: boolean
    sourcemap: boolean
    componentName: string
    interpretiveComments: boolean
    preserveHtmlComments: boolean
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

export type InputOptions = Required<CompileOptions & CompileIntermediateOptions> & {
    checkMode: boolean
}
export type AttributeValueEnclosure = "single" | "double" | "curly" | "none"
export type ReactiveIntrinsics = "reactive" | "raw" | "shallow" | "derived" | "alias"
