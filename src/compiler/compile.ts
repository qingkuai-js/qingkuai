import type {
    TemplateNode,
    CompileMessage,
    CompileResult,
    CompileOptions,
    StyleDescriptor,
    ScriptDescriptor,
    ASTPositionWithFlag,
    TopLevelIdentifierInfo,
    CompileIntermediateOptions
} from "#type-declarations/compiler"
import type { PositionFlag } from "./enums"

import ts from "typescript"

import { analyzeScript } from "./analyzer/script"
import { parseTemplate } from "./parser/template"
import { analyzeTemplate } from "./analyzer/template"
import { generateRuntimeCode } from "./transformer/runtime/codegen"
import { newCleanObj, traverseObject } from "../util/shared/sundry"
import { generateIntermediateCode } from "./transformer/check/codegen"
import { analyzeResult, inputDescriptor, messages, resetCompilerState } from "./state"

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
    resetCompilerState({ ...options, checkMode: true })

    const templateNodes = parseTemplate(source)
    analyzeScript()
    analyzeTemplate(templateNodes)

    const writer = generateIntermediateCode(templateNodes)
    const idStatusInfo: Record<string, string> = newCleanObj()
    traverseObject(analyzeResult.script.topLevelIdentifiers, (name, info) => {
        idStatusInfo[name] = getTopLevelIdentifierInfo(name, info)
    })

    const positions = inputDescriptor.positions
    const scriptDescriptor = inputDescriptor.script
    const styleDescriptors = inputDescriptor.styles
    return new CompileIntermediateResult(
        writer.code,
        messages,
        templateNodes,
        positions,
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
        public getTypeDelayInterIndexes: number[],
        public scriptDescriptor: ScriptDescriptor,
        public styleDescriptors: StyleDescriptor[],
        public identifierStatusInfo: Record<string, string>,
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

function getTopLevelIdentifierInfo(name: string, info: TopLevelIdentifierInfo) {
    switch (info.status) {
        case "literal": {
            return "raw (never mutated)"
        }
        case "pending": {
            return "raw (template unused)"
        }
        case "raw": {
            const declarator = info.nodeInfos[0].declarator as ts.VariableDeclaration
            const intrinsicName = analyzeResult.script.declaratorToIntrinsic
                .get(declarator)
                ?.getText()
            if (intrinsicName === "raw") {
                return "raw (explicit raw)"
            }
            if (inputDescriptor.options.shorthandDerivedDeclaration && name.startsWith("$")) {
                return "raw (constant literal, downgraded)"
            }
            return intrinsicName ? "raw (downgraded)" : "raw (implicit raw)"
        }
        default: {
            return `${info.status}${info.aliasTarget ? ` -> ${info.aliasTarget}` : ""}`
        }
    }
}
