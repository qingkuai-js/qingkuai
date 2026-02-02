import type { TemplateNode } from "#type-declarations/compiler"

import { analyzeResult } from "../state"
import { analyzeAttributes } from "./attribute"
import { newCleanObj } from "../../util/shared/sundry"
import { walkTemplateNodes } from "../../util/compiler/template"

export function analyzeTemplate(nodes: TemplateNode[]) {
    const { nodeInfos } = analyzeResult.template
    walkTemplateNodes(nodes, node => {
        let parentContextIdentifiers: Set<string> | undefined
        if (node.parent) {
            parentContextIdentifiers = nodeInfos.get(node.parent)?.contextIdentifiers
        }
        nodeInfos.set(node, {
            sortedDirectives: [],
            attributesMap: newCleanObj(),
            contextIdentifiers: new Set(parentContextIdentifiers)
        })
        analyzeAttributes(node)
    })
}
