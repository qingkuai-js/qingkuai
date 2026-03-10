import type {
    TemplateNode,
    CompileMessage,
    CompileOptions,
    StyleDescriptor,
    ScriptDescriptor,
    IdentifierStatus,
    TemplateAttribute,
    ASTPositionWithFlag,
    CompileResult,
    CompileIntermediateOptions
} from "#type-declarations/compiler"
import type { PositionFlag } from "./enums"

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
    ;(analyzeScript(), analyzeTemplate(templateNodes))

    const writer = generateRuntimeCode(templateNodes)
    return {
        code: writer.code,
        hashId: options.hashId!,
        mappings: writer.mappings,
        styles: inputDescriptor.styles
    } satisfies CompileResult
}

export function compileIntermediate(source: string, options: CompileIntermediateOptions) {
    resetCompilerState({ ...options, checkMode: true })

    const templateNodes = parseTemplate(source)
    ;(analyzeScript(), analyzeTemplate(templateNodes))

    const writer = generateIntermediateCode(templateNodes)
    const idStatusMap: Record<string, IdentifierStatus> = newCleanObj()
    traverseObject(analyzeResult.script.topLevelIdentifiers, (name, info) => {
        idStatusMap[name] = info.status
    })

    const positions = inputDescriptor.positions
    const scriptDescriptor = inputDescriptor.script
    const styleDescriptors = inputDescriptor.styles
    return new CompileIntermediateResult(
        writer.code,
        messages,
        templateNodes,
        scriptDescriptor,
        styleDescriptors,
        writer.gtdii,
        positions,
        writer.indexMap,
        idStatusMap,
        analyzeResult.template.slots,
        analyzeResult.template.eventInfos,
        analyzeResult.template.nodeContexts
    )
}

export class CompileIntermediateResult {
    public slotNames: string[] = []

    constructor(
        public code: string,
        public messages: CompileMessage[],
        public templateNodes: TemplateNode[],
        public scriptDescriptor: ScriptDescriptor,
        public styleDescriptors: StyleDescriptor[],
        public getTypeDelayInterIndexes: number[],
        private positions: ASTPositionWithFlag[],
        private indexMap: { itos: number[]; stoi: number[] },
        private idStatusMap: Record<string, IdentifierStatus>,
        private slots: (typeof analyzeResult)["template"]["slots"],
        private eventInfos: (typeof analyzeResult)["template"]["eventInfos"],
        private nodeContexts: (typeof analyzeResult)["template"]["nodeContexts"]
    ) {
        traverseObject(slots, name => this.slotNames.push(name))
    }

    getPosition(index: number) {
        return this.positions[index]
    }

    getLocation(start: number, end = start) {
        return {
            start: this.getPosition(start),
            end: this.getPosition(end)
        }
    }

    isPositionFlagSetAtIndex(flag: PositionFlag, index: number) {
        return !!(this.positions[index].flag & flag)
    }

    getInterIndex(sourceIndex: number) {
        return this.indexMap.stoi[sourceIndex]
    }

    getSourceIndex(interIndex: number) {
        return this.indexMap.itos[interIndex]
    }

    getIdentifierStatus(name: string) {
        return this.idStatusMap[name]
    }

    getEventInfo(event: TemplateAttribute) {
        return this.eventInfos.get(event)
    }

    getTemplateNodeContext(node: TemplateNode) {
        return this.nodeContexts.get(node)!
    }

    getSlotTemplateNode(name: string): TemplateNode | undefined {
        return this.slots[name]
    }
}
