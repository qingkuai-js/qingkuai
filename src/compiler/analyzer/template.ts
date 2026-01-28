import type { TemplateNode } from "#type-declarations/compiler"

import { analyzeResult } from "../state"
import { analyzeAttributes } from "./attribute"
import { walkTemplateNodes } from "../../util/compiler/template"

export function analyzeTemplate(nodes: TemplateNode[]) {
    const { nodeInfos } = analyzeResult.template
    walkTemplateNodes(nodes, node => {
        let parentContextIdentifiers: Set<string> | undefined
        if (node.parent) {
            parentContextIdentifiers = nodeInfos.get(node.parent)?.contextIdentifiers
        }
        nodeInfos.set(node, {
            directives: [],
            attributesMap: {},
            contextIdentifiers: new Set(parentContextIdentifiers)
        })
        analyzeAttributes(node)
    })
}
