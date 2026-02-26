import type {
    AnalyzeResult,
    CompileMessage,
    CompileOptions,
    InputDescriptor
} from "#type-declarations/compiler"

import { isUndefined } from "../util/shared/assert"
import { objectAssign } from "../util/shared/aliases"
import { createHashId } from "../util/compiler/sundry"
import { newASTLocation } from "../util/compiler/position"
import { newCleanObj, stripPrototype } from "../util/shared/sundry"

export let analyzeResult: AnalyzeResult
export let messages: CompileMessage[] = []
export let inputDescriptor: InputDescriptor

export function resetCompilerState(options: CompileOptions) {
    messages = []
    analyzeResult = newAnalyzeResult()
    inputDescriptor = newInputDescriptor(options)

    if (!inputDescriptor.options.debug && !inputDescriptor.options.checkMode) {
        analyzeResult.template.compressStrings[` qk-${inputDescriptor.options.hashId}`] = {
            id: "",
            times: 2
        }
    }
}

function newAnalyzeResult(): AnalyzeResult {
    return {
        template: {
            delegateEvents: {
                passive: new Set(),
                nonPassive: new Set()
            },
            eventInfos: new Map(),
            nodeContexts: new Map(),
            parsedPatterns: new Map(),
            parsedExpressions: new Map(),
            staticTextContents: new Map(),
            compressStrings: newCleanObj(),
            validReferenceAttributes: new Set()
        },
        script: {
            watchers: [],
            defaultItems: {},
            stringLiterals: [],
            importDeclarations: [],
            eliminatedNodes: new Set(),
            fullIdentifiers: new Set(),
            declaratorToAliasInfos: new Map(),
            declaratorToIntrinsic: new Map(),
            topLevelReferences: newCleanObj(),
            topLevelIdentifiers: newCleanObj(),
            preMutatedTopLevelIdentifiers: new Set()
        },
        generateIds: stripPrototype({
            internal: "",
            setterArg: ""
        }),
        slots: newCleanObj(),
        commonStrings: newCleanObj()
    }
}

// 生成一个新的输入源状态描述符
// Generate a new input source descriptor
function newInputDescriptor(options: CompileOptions) {
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
            tipComment: false,
            componentName: "",
            trimTextEdges: true,
            typeImportStatement: "",
            reactivityMode: "reactive",
            preserveCommentNodes: false,
            checkTemplateStructure: true,
            collapseWhitespaceOnlyText: false,
            shorthandDerivedDeclaration: true
        }
    }
    if (!options.hashId) {
        ret.options.hashId = createHashId()
    }
    if (options.debug) {
        if (isUndefined(options.sourcemap)) {
            ret.options.sourcemap = true
        }
        if (isUndefined(options.tipComment)) {
            ret.options.tipComment = true
        }
        if (isUndefined(options.preserveCommentNodes)) {
            ret.options.preserveCommentNodes = true
        }
    }
    return (objectAssign(ret.options, options), ret)
}
