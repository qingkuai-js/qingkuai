import type { TemplateNode } from "#type-declarations/compiler"

import { analyzeResult } from "../../state"

export function transformTemplate(nodes: TemplateNode[]) {
    const fragments: string[] = []

    for (const node of nodes) {
        const nodeInfo = analyzeResult.template.nodeInfos.get(node)!
    }
}
