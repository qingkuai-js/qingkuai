import type TS from "typescript"

import type { Pair } from "#type-declarations/tools"
import type { TestingMode } from "../compiler/enums"
import type { TopLevelDeclarationNode, TopLevelDeclaratorNode } from "./ts-ast"

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
    global: boolean
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
    content: {
        value: string
        isText: boolean
    }[]
    selections: {
        id: string
        index: number
        replaceWithText: boolean
        parent: string | undefined
    }[]
    id: string
    flag: number
    getterId: string
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
    hasActualAncestor: boolean
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
    directive: ParsedDirective
    node: TS.ArrayBindingElement
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
    node: TS.Expression
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
    id: TS.Identifier
    declarator: TopLevelDeclaratorNode
    declaration: TopLevelDeclarationNode
    destructuringIdentifierNames?: string[]
}
export interface TopLevelIdentifierInfo {
    hoist: boolean
    implicit: boolean
    accessor: boolean
    aliasTarget: string
    transformTo: string
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
    anchorBracket: TemplateFragment | null
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
    keyedSelectorInfos: Map<TemplateNodeContext, GeneratedSelectorInfo[]>
}
export interface ScriptAnalyzeRet {
    declaratorToAliasInfos: Map<
        TS.VariableDeclaration,
        {
            property: string
            expression: string
        }[]
    >
    exportStatements: TS.Node[]
    usedIntrinsics: Set<string>
    fullIdentifiers: Set<string>
    eliminatedNodes: Set<TS.Node>
    importIdentifiers: Set<string>
    exportedBindings: ExportBinding[]
    watchExpCalls: TS.CallExpression[]
    setContextExpCalls: TS.CallExpression[]
    topLevelReferences: TopLevelReferences
    qkDefaultImportIdentifiers: Set<string>
    preMutatedTopLevelIdentifiers: Set<string>
    defaultsCall: TS.CallExpression | undefined
    reusedStringReferences: ReusedStringReference[]
    topLevelIdentifiers: Record<string, TopLevelIdentifierInfo>
    declaratorToIntrinsic: Map<TS.VariableDeclaration, TS.Identifier>
    importDeclarations: (TS.ImportDeclaration | TS.ImportEqualsDeclaration)[]
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
export type IdentifierStatusInfo = Record<
    string,
    {
        inlays: {
            index: number
            kind: InlayHintKind
        }[]
        description: string
        status: IdentifierStatus
    }
>

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
    testing: TestingMode
    replaceQkImports: boolean
    allowConstReactive: boolean
    interpretiveComments: boolean
    preserveHtmlComments: boolean
    reactivityMode: "reactive" | "shallow"
    whitespace: "preserve" | "trim" | "collapse" | "trim-collapse"
}>

export type CompileIntermediateOptions = Pick<CompileOptions, "allowConstReactive">

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

export type GenerateIdentifierStaticKeys =
    | "meta"
    | "anchor"
    | "internal"
    | "getterArg"
    | "setterArg"
    | "component"
    | "compressStrings"

export type GenerateIdentifier = Record<GenerateIdentifierStaticKeys, string> & {
    suffix: Record<
        string,
        {
            last: number
            originUsed: boolean
        }
    >
    prefix: Record<string, number>
}

export type InputOptions = Required<CompileOptions & CompileIntermediateOptions> & {
    checkMode: boolean
}
export type ParseDiatnosticDealtKind = "record" | "ignore" | "thrown"
export type InlayHintKind = "variable" | "function" | "class" | "enum"
export type AttributeValueEnclosure = "single" | "double" | "curly" | "none"
export type ReactiveIntrinsics = "reactive" | "raw" | "shallow" | "derived" | "alias"
