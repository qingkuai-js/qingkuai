import type {
    AnalyzeResult,
    CompileMessage,
    CompileOptions,
    InputDescriptor
} from "#type-declarations/compiler"

import { isUndefined } from "../util/shared/assert"
import { newCleanObj, stripPrototype } from "../util/shared/sundry"
import { objectAssign } from "../util/shared/aliases"
import { newASTLocation } from "../util/compiler/position"

export let messages: CompileMessage[] = []
export let inputDescriptor: InputDescriptor
export let analyzeResult = newAnalyzeResult()

export function resetCompilerState(options: CompileOptions) {
    messages = []
    analyzeResult = newAnalyzeResult()
    inputDescriptor = newInputDescriptor(options)
}

function newAnalyzeResult(): AnalyzeResult {
    return {
        template: {
            delegateEvents: {
                passive: new Set(),
                nonPassive: new Set()
            },
            nodeInfos: new Map(),
            eventInfos: new Map(),
            parsedPatterns: new Map(),
            parsedExpressions: new Map(),
            validReferenceAttributes: new Set()
        },
        script: {
            watchers: [],
            stringLiterals: [],
            importDeclarations: [],
            eliminateNodes: new Set(),
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
            typeImportStatement: "",
            reactivityMode: "reactive",
            reserveCommentNodes: false,
            checkTemplateStructure: true,
            shorthandDerivedDeclaration: true
        }
    }
    if (options.debug) {
        if (isUndefined(options.sourcemap)) {
            ret.options.sourcemap = true
        }
        if (isUndefined(options.tipComment)) {
            ret.options.tipComment = true
        }
        if (isUndefined(options.reserveCommentNodes)) {
            ret.options.reserveCommentNodes = true
        }
    }
    return (objectAssign(ret.options, options), ret)
}
