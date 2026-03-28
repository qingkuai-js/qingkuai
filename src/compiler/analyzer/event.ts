import type { TemplateAttribute, TemplateNode } from "#type-declarations/compiler"

import { analyzeResult } from "../state"
import { parseEventFlag } from "../parser/event"
import { DELEGATABLE_EVENTS } from "../constants"
import { RedundantEventFlags } from "../message/warn"
import { EVENT_PASSIVE } from "../../util/shared/flags"
import { getLocByIndex } from "../../util/compiler/position"
import { shouldAnalyzeAttributeValue } from "../../util/compiler/assert"
import { increaseReusedStringUsedTimes } from "../transformer/runtime/compress"
import { analyzeInterpolation, analyzeTemplateAsExpression } from "./interpolation"

export function analyzeEvent(node: TemplateNode, event: TemplateAttribute) {
    const nameLoc = event.name.loc
    const rawName = event.name.raw
    const isComponent = !!node.componentTag
    const parseResult = parseEventFlag(event)
    analyzeResult.template.parsedEvents.set(event, parseResult)
    increaseReusedStringUsedTimes(parseResult.eventName.slice(1), isComponent)

    if (isComponent && rawName !== parseResult.eventName) {
        RedundantEventFlags(
            getLocByIndex(nameLoc.start.index + parseResult.eventName.length, nameLoc.end.index)
        )
    }

    const delegateEventName = parseResult.eventName.slice(1)
    if (!isComponent && DELEGATABLE_EVENTS.has(delegateEventName)) {
        const passive = parseResult.generalFlag.value & EVENT_PASSIVE
        analyzeResult.template.delegateEvents[passive ? "passive" : "nonPassive"].add(
            delegateEventName
        )
    }

    // 同名简写语法，更新顶级作用域标识符的响应性状态
    // For shorthand properties with the same name, update the reactive status of the corresponding top-level scope identifier.
    if (!event.equalSign) {
        const eventNameLoc = getLocByIndex(
            nameLoc.start.index,
            nameLoc.start.index + parseResult.eventName.length
        )
        analyzeTemplateAsExpression(node, parseResult.eventName, event, eventNameLoc, "attribute")
    }

    if (shouldAnalyzeAttributeValue(event)) {
        analyzeInterpolation(node, event, event.value.raw, event.value.loc.start.index)
    }
}
