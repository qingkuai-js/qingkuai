import type ts from "typescript"
import type { Pair } from "#type-declarations/tools"
import type { ContextPattern, TopLevelDeclarationNode, TopLevelDeclaratorNode } from "./ts-ast"

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
    flag: number
    getterId: string
    content: string[]
    usedCompressString: boolean
    directChildrenCount: number
    getWith: TemplateFragment | undefined
    nodeContext: TemplateNodeContext | null
}

export interface TextContentPart {
    value: string
    loc: ASTLocation
    isInterpolated: boolean
}
export interface TemplateTypeArgument {
    raw: string
    loc: ASTLocation
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
    typeArgument: TemplateTypeArgument | null
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
    compressStrings: string
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
    items: {
        name: string
        sourceRange: Range
    }[]
    value: number
}
export interface ExportBinding {
    local: string
    exported: string
}
export interface ContextReference {
    range: Range
    shorthand: boolean
    pattern: ParsedPattern
}
export interface ComponentTagPart {
    id: string
    sourceRange: Range
}
export interface ParsedPattern {
    sourceRange: Range
    node: ContextPattern
    directive: ParsedDirective
    declaredIdentifiers: Set<string>
}
export interface ParsedDirective {
    context?: {
        argId: string
        returnsId: string
    }
    src: {
        directive: TemplateAttribute
        nodeContext: TemplateNodeContext
    }
    base: string
    keywordIndex: number
    patterns: ParsedPattern[]
    baseStartSourceIndex: number
}
export interface StringLiteralDetail {
    value: string
    computed: boolean
    propertyName: boolean
}
export interface ReusedStringReference {
    range: Range
    value: string
    computed: boolean
}
export interface ParsedExpression {
    source: string
    node: ts.Expression
    reactive: boolean
    startSourceIndex: number
    contextReferences: ContextReference[]
    topLevelReferences: TopLevelReferences
    reusedStringReferences: ReusedStringReference[]
}
export interface GeneratedSelectorInfo {
    id: string
    expressionKey: any
    operation: SelectorOperation
    topLevelTransformedTo: string
    topLevelIdentifierName: string
    keyDirective: TemplateAttribute
    forNodeContext: TemplateNodeContext
    targetNodeContext: TemplateNodeContext

    targetTextPart?: TextContentPart
    targetAttribute?: TemplateAttribute
}
export interface TopLevelIdentifierNodeInfo {
    id: ts.Identifier
    declarator: TopLevelDeclaratorNode
    declaration: TopLevelDeclarationNode
    destructuringIdentifierNames?: string[]
}
export interface TopLevelIdentifierInfo {
    path: string
    hoist: boolean
    implicit: boolean
    accessor: boolean
    transofrmedTo: string
    status: IdentifierStatus
    usedExpressions: Set<ParsedExpression>
    nodeInfos: TopLevelIdentifierNodeInfo[]
}
export interface TemplateNodeContext {
    id: string
    anchorId: string
    node: TemplateNode
    shouldBeSelected: boolean
    selectableChildCount: number
    fragment: TemplateFragment | null
    eventListeners: TemplateAttribute[]
    sortedDirectives: TemplateAttribute[]
    staticAttributes: TemplateAttribute[]
    dynamicAttributes: TemplateAttribute[]
    referenceAttributes: TemplateAttribute[]
    attributesMap: Record<string, TemplateAttribute>
    contextIdentifiers: Record<string, ParsedDirective>
}

export interface TemplateAnalyzeRet {
    delegateEvents: {
        passive: Set<string>
        nonPassive: Set<string>
    }
    keyedSelectorInfos: Map<TemplateNodeContext, GeneratedSelectorInfo[]>
    parsedEvents: Map<
        TemplateAttribute,
        {
            eventName: string
            generalFlag: EventFlagInfo
            wrapperFlag: EventFlagInfo
        }
    >
    slots: Record<string, TemplateNode>
    componentFragment: TemplateFragment | null
    parsedExpressions: Map<any, ParsedExpression>
    staticTextContents: Map<TextContentPart, string>
    validReferenceAttributes: Set<TemplateAttribute>
    nodeContexts: Map<TemplateNode, TemplateNodeContext>
    parsedDirectives: Map<TemplateAttribute, ParsedDirective>
}
export interface ScriptAnalyzeRet {
    defaultItems: Partial<
        Record<
            "refs" | "props",
            {
                intrinsicId: ts.Identifier
                value: ts.Expression | ts.SpreadElement
            }
        >
    >
    exportStatements: ts.Node[]
    watchers: ts.CallExpression[]
    fullIdentifiers: Set<string>
    eliminatedNodes: Set<ts.Node>
    usedIntrinsicVars: Set<string>
    importIdentifiers: Set<string>
    exportedBindings: ExportBinding[]
    topLevelReferences: TopLevelReferences
    preMutatedTopLevelIdentifiers: Set<string>
    reusedStringReferences: ReusedStringReference[]
    topLevelIdentifiers: Record<string, TopLevelIdentifierInfo>
    declaratorToIntrinsic: Map<ts.VariableDeclaration, ts.Identifier>
    importDeclarations: (ts.ImportDeclaration | ts.ImportEqualsDeclaration)[]
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

export interface CompileIntermediateOptions {
    shorthandDerivedDeclaration?: boolean
}

export interface CompileResult {
    code: string
    hashId: string
    mappings: string
    messages: CompileMessage[]
    positions: ASTPositionWithFlag[]
    scriptDescriptor: ScriptDescriptor
    styleDescriptors: StyleDescriptor[]
}

export type StandaloneParseTemplateOptions = Partial<{
    recover: boolean
    preserveCommentNodes: boolean
    preserveBlankTextNodes: boolean
    checkTemplateStructure: boolean
    checkEmptyInterpolation: boolean
    checkAttributeValueEnclosure: boolean
}>

export type CompileOptions = Partial<{
    hashId: string
    debug: boolean
    sourcemap: boolean
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

export type SelectorOperation =
    | {
          method: "setText"
      }
    | {
          method: "setAttribute"
          attrName: string
      }
    | {
          method: "setXlinkAttribute"
          attrName: string
      }
    | {
          method: "setClassName"
          staticClassAttr?: TemplateAttribute
      }

export type SelectionCacheItem = {
    id: string
    index: number
}
export type SelectionCache = Record<string, SelectionCacheItem[]>

export type InputOptions = Required<CompileOptions & CompileIntermediateOptions> & {
    checkMode: boolean
}
export type AttributeValueEnclosure = "single" | "double" | "curly" | "none"
export type ReactiveIntrinsics = "reactive" | "raw" | "shallow" | "derived" | "alias"
