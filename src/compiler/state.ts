import type {
    InputOptions,
    AnalyzeResult,
    CompileMessage,
    InputDescriptor,
    GenerateIdentifier
} from "#type-declarations/compiler"

import { isUndefined } from "../util/shared/assert"
import { newCleanObj } from "../util/shared/sundry"
import { objectAssign } from "../util/shared/aliases"
import { createHashId } from "../util/compiler/sundry"
import { newASTLocation } from "../util/compiler/position"

export let analyzeResult: AnalyzeResult
export let messages: CompileMessage[] = []
export let inputDescriptor: InputDescriptor
export let generateIdentifier: GenerateIdentifier

export function resetCompilerState(options: Partial<InputOptions>) {
    messages = []
    analyzeResult = newAnalyzeResult()
    generateIdentifier = newGenerateIdentifier()
    inputDescriptor = newInputDescriptor({ ...options })
}

function newGenerateIdentifier(): GenerateIdentifier {
    return {
        anchor: "",
        context: "",
        internal: "",
        getterArg: "",
        setterArg: "",
        compressStrings: "",
        suffix: newCleanObj(),
        prefix: newCleanObj()
    }
}

function newAnalyzeResult(): AnalyzeResult {
    return {
        template: {
            delegateEvents: {
                passive: new Set(),
                nonPassive: new Set()
            },
            slots: newCleanObj(),
            parsedEvents: new Map(),
            nodeContexts: new Map(),
            componentFragment: null,
            parsedDirectives: new Map(),
            parsedExpressions: new Map(),
            staticTextContents: new Map(),
            parsedComponentTags: new Map(),
            validReferenceAttributes: new Set()
        },
        script: {
            watchers: [],
            defaultItems: {},
            importDeclarations: [],
            eliminatedNodes: new Set(),
            fullIdentifiers: new Set(),
            usedIntrinsicVars: new Set(),
            importIdentifiers: new Set(),
            declaratorToAliasInfos: new Map(),
            declaratorToIntrinsic: new Map(),
            topLevelReferences: newCleanObj(),
            topLevelIdentifiers: newCleanObj(),
            preMutatedTopLevelIdentifiers: new Set()
        },
        reusedStrings: newCleanObj()
    }
}

// 生成一个新的输入源状态描述符
// Generate a new input source descriptor
function newInputDescriptor(options: Partial<InputOptions>) {
    const ret: InputDescriptor = {
        indent: "",
        source: "",
        styles: [],
        positions: [],
        script: {
            code: "",
            lineCount: 0,
            isTS: false,
            existing: false,
            loc: newASTLocation(),
            startTagOpenRange: [-1, -1]
        },
        options: {
            hashId: "",
            debug: false,
            sourcemap: false,
            checkMode: false,
            reactivityMode: "reactive",
            interpretiveComments: false,
            typeDeclarationFilePath: "",
            whitespace: "trim-collapse",
            preserveHtmlComments: false,
            shorthandDerivedDeclaration: true
        }
    }
    if (!options.hashId) {
        options.hashId = createHashId()
    }
    if (options.debug) {
        if (isUndefined(options.sourcemap)) {
            options.sourcemap = true
        }
        if (isUndefined(options.interpretiveComments)) {
            options.interpretiveComments = true
        }
        if (isUndefined(options.preserveHtmlComments)) {
            options.preserveHtmlComments = true
        }
    }
    return (objectAssign(ret.options, options), ret)
}
