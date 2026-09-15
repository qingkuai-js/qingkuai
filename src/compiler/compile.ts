import type TS from "typescript"

import type {
    TemplateNode,
    CompileMessage,
    InlayHintKind,
    CompileResult,
    CompileOptions,
    StyleDescriptor,
    ScriptDescriptor,
    ASTPositionWithFlag,
    IdentifierStatusInfo,
    TopLevelIdentifierInfo,
    CompileIntermediateOptions,
    TopLevelIdentifierNodeInfo
} from "#type-declarations/compiler"
import type { PositionFlag } from "./enums"

import ts from "typescript"

import {
    messages,
    analyzeResult,
    inputDescriptor,
    resetCompilerState,
    tsParsingDiagnostics
} from "./state"
import { isLeftValue } from "./ts-ast/assert"
import { analyzeScript } from "./analyzer/script"
import { parseTemplate } from "./parser/template"
import { analyzeTemplate } from "./analyzer/template"
import { getStriptTypeOperationsParent } from "./ts-ast/sundry"
import { getScriptSourceIndex } from "../util/compiler/position"
import { generateRuntimeCode } from "./transformer/runtime/codegen"
import { newCleanObj, traverseObject } from "../util/shared/sundry"
import { generateIntermediateCode } from "./transformer/check/codegen"

export function compile(source: string, options: CompileOptions = {}) {
    resetCompilerState(options)

    const templateNodes = parseTemplate(source)
    analyzeScript()
    analyzeTemplate(templateNodes)

    const writer = generateRuntimeCode(templateNodes)
    return {
        messages,
        code: writer.code,
        mappings: writer.mappings,
        positions: inputDescriptor.positions,
        hashId: inputDescriptor.options.hashId!,
        scriptDescriptor: inputDescriptor.script,
        styleDescriptors: inputDescriptor.styles
    } satisfies CompileResult
}

export function compileIntermediate(source: string, options: CompileIntermediateOptions = {}) {
    resetCompilerState({
        ...options,
        checkMode: true,
        preserveHtmlComments: true
    })

    const templateNodes = parseTemplate(source)
    analyzeScript()
    analyzeTemplate(templateNodes)

    const writer = generateIntermediateCode(templateNodes)
    const idStatusInfo: IdentifierStatusInfo = newCleanObj()
    const untrackedReadNames = collectUntrackedTemplateReadNames()
    traverseObject(analyzeResult.script.topLevelIdentifiers, (name, info) => {
        idStatusInfo[name] = {
            status: getIdentifierStatusForInlayHint(info),
            description: getTopLevelIdentifierInfo(info, untrackedReadNames.has(name)),
            inlays: info.nodeInfos.map(nodeInfo => {
                return {
                    kind: getInlayHintKind(nodeInfo),
                    index: getScriptSourceIndex(nodeInfo.id.getEnd())
                }
            })
        }
    })

    const positions = inputDescriptor.positions
    const scriptDescriptor = inputDescriptor.script
    const styleDescriptors = inputDescriptor.styles
    return new CompileIntermediateResult(
        writer.code,
        messages,
        templateNodes,
        positions,
        tsParsingDiagnostics,
        writer.gtdii,
        scriptDescriptor,
        styleDescriptors,
        idStatusInfo,
        writer.indexMap,
        analyzeResult.template.slots,
        analyzeResult.template.nodeContexts
    )
}

export class CompileIntermediateResult {
    public slotNames: string[] = []

    constructor(
        public code: string,
        public messages: CompileMessage[],
        public templateNodes: TemplateNode[],
        public positions: ASTPositionWithFlag[],
        public parseDiagnostics: TS.Diagnostic[],
        public getTypeDelayInterIndexes: number[],
        public scriptDescriptor: ScriptDescriptor,
        public styleDescriptors: StyleDescriptor[],
        public identifierStatusInfo: IdentifierStatusInfo,
        public indexMap: { itos: number[]; stoi: number[] },
        private slots: (typeof analyzeResult)["template"]["slots"],
        private nodeContexts: (typeof analyzeResult)["template"]["nodeContexts"]
    ) {
        traverseObject(slots, name => this.slotNames.push(name))
    }

    getSourceIndex(interIndex: number) {
        return this.indexMap.itos[interIndex]
    }

    getInterIndex(sourceIndex: number) {
        return this.indexMap.stoi[sourceIndex]
    }

    getTemplateNodeContext(node: TemplateNode) {
        return this.nodeContexts.get(node)!
    }

    getSlotTemplateNode(name: string): TemplateNode | undefined {
        return this.slots[name]
    }

    isPositionFlagSetAtIndex(flag: PositionFlag, index: number) {
        return !!(this.positions[index].flag & flag)
    }
}

function getIdentifierStatusForInlayHint(info: TopLevelIdentifierInfo) {
    switch (info.status) {
        case "literal":
        case "pending":
        case "raw": {
            return "raw"
        }
        default: {
            return info.status
        }
    }
}

function getInlayHintKind(nodeInfo: TopLevelIdentifierNodeInfo): InlayHintKind {
    switch (nodeInfo.declaration.kind) {
        case ts.SyntaxKind.FunctionDeclaration: {
            return "function"
        }
        case ts.SyntaxKind.ClassDeclaration: {
            return "class"
        }
        case ts.SyntaxKind.EnumDeclaration: {
            return "enum"
        }
        default: {
            return "variable"
        }
    }
}

// 收集在模板中仅以非追踪方式（raw 参数子树内）被读取的顶层标识符名称
// Collect names of top-level identifiers that are only read untracked
// (inside the argument subtree of a raw call) in the template.
function collectUntrackedTemplateReadNames() {
    const names = new Set<string>()
    const trackedNames = new Set<string>()
    for (const parsedExpression of analyzeResult.template.parsedExpressions.values()) {
        traverseObject(parsedExpression.topLevelReferences, (name, references) => {
            if (references.some(reference => !reference.untracked)) {
                trackedNames.add(name)
            } else {
                names.add(name)
            }
        })
    }
    for (const name of trackedNames) {
        names.delete(name)
    }
    return names
}

// 判断 alias 声明是否为非法形态，判断条件与 `checkUsageOfIntrinsicMethods` 保持一致：
// 首参缺失、首参是展开元素、首参不是左值，或直接别名一个独立标识符时视为非法；
// 首个参数之后的其余参数会被忽略，不影响合法性判断。
//
// Determine whether an alias declaration is invalid. The conditions mirror those in
// `checkUsageOfIntrinsicMethods`: invalid when the first argument is missing, is a
// spread element, is not a left value, or aliases a standalone identifier. Arguments
// after the first are ignored and do not affect validity.
function isInvalidAliasDeclaration(info: TopLevelIdentifierInfo) {
    const declarator = info.nodeInfos[0].declarator as TS.VariableDeclaration
    const callee = analyzeResult.script.declaratorToIntrinsic.get(declarator)
    const call = callee && getStriptTypeOperationsParent(callee)
    if (!info.aliasTarget || !call || !ts.isCallExpression(call)) {
        return true
    }

    const firstArg = call.arguments[0]
    return (
        !firstArg ||
        !isLeftValue(firstArg) ||
        ts.isSpreadElement(firstArg) ||
        (ts.isIdentifier(firstArg) && ts.isIdentifier(declarator.name))
    )
}

function getTopLevelIdentifierInfo(info: TopLevelIdentifierInfo, untrackedInTemplate = false) {
    switch (info.status) {
        case "literal": {
            return "raw (never mutated)"
        }
        case "alias": {
            if (isInvalidAliasDeclaration(info)) {
                return "alias (invalid)"
            }
            return `alias -> ${info.aliasTarget}`
        }
        case "raw": {
            const declarator = info.nodeInfos[0].declarator as TS.VariableDeclaration
            const intrinsicName = analyzeResult.script.declaratorToIntrinsic
                .get(declarator)
                ?.getText()
            if (intrinsicName === "raw") {
                return "raw (explicit raw)"
            }
            return intrinsicName ? "raw (downgraded)" : "raw (implicit raw)"
        }
        case "pending": {
            return `raw (${untrackedInTemplate ? "untracked" : "unused"} in template)`
        }
        default: {
            return info.status
        }
    }
}
