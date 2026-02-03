import type { TemplateAttribute, TemplateNode } from "#type-declarations/compiler"

import { analyzeResult } from "../state"
import { parseEventFlag } from "../parser/event"
import { RedundantEventFlags } from "../message/warn"
import { getLocByIndex } from "../../util/compiler/position"
import { shouldAnalyzeAttributeValue } from "../../util/compiler/assert"
import { analyzeInterpolation, analyzeShorthandAttribute } from "./interpolation"

export function analyzeEvent(node: TemplateNode, event: TemplateAttribute) {
    const nameLoc = event.name.loc
    const rawName = event.name.raw
    const isComponent = !!node.componentTag
    const parseResult = parseEventFlag(rawName, nameLoc.start.index)
    if (isComponent && rawName !== parseResult.eventName) {
        RedundantEventFlags(
            getLocByIndex(nameLoc.start.index + parseResult.eventName.length, nameLoc.end.index)
        )
    }
    if (rawName !== parseResult.eventName) {
        analyzeResult.template.eventInfos.set(event, parseResult)
    }

    // 同名简写语法，更新顶级作用域标识符的响应性状态
    // For shorthand properties with the same name, update the reactive status of the corresponding top-level scope identifier.
    if (!event.equalSign) {
        analyzeShorthandAttribute(
            parseResult.eventName,
            getLocByIndex(nameLoc.start.index, nameLoc.start.index + parseResult.eventName.length)
        )
    }

    if (shouldAnalyzeAttributeValue(event)) {
        analyzeInterpolation(node, event, event.value.raw, event.value.loc.start.index)
    }
}
