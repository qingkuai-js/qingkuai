import type TS from "typescript"

import type {
    TemplateNode,
    CompileMessage,
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

import ts from "./ts-api"

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
import { PositionFlag, IdentifierStatus, InlayHintKind } from "./enums"

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
    traverseObject(analyzeResult.script.topLevelIdentifiers, (name, info) => {
        idStatusInfo[name] = {
            inlays: info.nodeInfos.map(nodeInfo => {
                return {
                    kind: getInlayHintKind(nodeInfo),
                    index: getScriptSourceIndex(nodeInfo.id.getEnd())
                }
            }),
            description: getTopLevelIdentifierInfo(info),
            status: getIdentifierStatusForInlayHint(info)
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
        const position = this.positions[index]
        return !!position && !!(position.flag & flag)
    }
}

function getIdentifierStatusForInlayHint(info: TopLevelIdentifierInfo): IdentifierStatus {
    switch (info.status) {
        case IdentifierStatus.Raw:
        case IdentifierStatus.Literal:
        case IdentifierStatus.Pending: {
            return IdentifierStatus.Raw
        }
        default: {
            return info.status
        }
    }
}

function getInlayHintKind(nodeInfo: TopLevelIdentifierNodeInfo): InlayHintKind {
    switch (nodeInfo.declaration.kind) {
        case ts.SyntaxKind.FunctionDeclaration: {
            return InlayHintKind.Function
        }
        case ts.SyntaxKind.ClassDeclaration: {
            return InlayHintKind.Class
        }
        case ts.SyntaxKind.EnumDeclaration: {
            return InlayHintKind.Enum
        }
        default: {
            return InlayHintKind.Variable
        }
    }
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

function getTopLevelIdentifierInfo(info: TopLevelIdentifierInfo) {
    switch (info.status) {
        case IdentifierStatus.Literal: {
            return "raw (never mutated)"
        }
        case IdentifierStatus.Alias: {
            if (isInvalidAliasDeclaration(info)) {
                return "alias (invalid)"
            }
            return `alias -> ${info.aliasTarget}`
        }
        case IdentifierStatus.Raw: {
            const declarator = info.nodeInfos[0].declarator as TS.VariableDeclaration
            const intrinsicName = analyzeResult.script.declaratorToIntrinsic
                .get(declarator)
                ?.getText()
            if (intrinsicName === "raw") {
                return "raw (explicit raw)"
            }
            return intrinsicName ? "raw (downgraded)" : "raw (implicit raw)"
        }
        case IdentifierStatus.Pending: {
            return `raw (${info.untrackedAccess ? "untracked" : "not accessed"} in template)`
        }
        default: {
            return info.status
        }
    }
}
