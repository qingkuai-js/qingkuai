import type { TemplateNode } from "#type-declarations/compiler"

import { analyzeAttributes } from "./attribute"
import { walkTemplateNodes } from "../../util/compiler/template"
import { analyzeResult } from "../state"

export function analyzeTemplate(nodes: TemplateNode[]) {
    walkTemplateNodes(nodes, node => {
        analyzeResult.template.nodeInfos.set(node, {
            directives: [],
            attributesMap: {},
            contextIdentifiers: new Set()
        })
        analyzeAttributes(node)
    })
}
