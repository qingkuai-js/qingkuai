import type { TemplateAttribute, TemplateNode } from "#type-declarations/compiler"

import { analyzeResult } from "../state"
import { parseEventFlag } from "../parser/event"
import { RedundantEventFlags } from "../message/warn"
import { getLocByIndex } from "../../util/compiler/position"
import { analyzeInterpolation, updateTopLevelIdentifierStatus } from "./interpolation"

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
    if (!event.equalSign) {
        updateTopLevelIdentifierStatus(parseResult.eventName)
    } else if (event.valueEnclosure !== "none") {
        analyzeInterpolation(node, event, event.value.raw, event.value.loc.start.index)
    }
}
