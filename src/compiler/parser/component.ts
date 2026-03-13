import type { ParseComponentTagFunc } from "#type-declarations/compiler-ex"
import type { ComponentTagPart, TemplateNode } from "#type-declarations/compiler"

import { kebab2Camel } from "../../util/compiler/string"

export const parseComponentTag: ParseComponentTagFunc = (componentNode: TemplateNode) => {
    let startSourceIndex = componentNode.loc.start.index + 1
    const componentTagParts: ComponentTagPart[] = []
    for (const part of componentNode.tag.split(".")) {
        componentTagParts.push({
            id: kebab2Camel(part),
            sourceRange: [startSourceIndex, startSourceIndex + part.length]
        })
        startSourceIndex += part.length + 1
    }
    return componentTagParts
}
