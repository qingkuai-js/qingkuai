import type { TemplateAttribute, TemplateNode } from "#type-declarations/compiler";

import { analyzeResult } from "../state";
import { parseEventFlag } from "../parser/event";
import { AnalyzeExpressionType } from "../enums";
import { DELEGATABLE_EVENTS } from "../constants";
import { RedundantEventFlags } from "../message/warn";
import { getLocByIndex } from "../../util/compiler/position";
import { EVENT_PASSIVE, EVENT_NATIVE } from "../../util/shared/flags";
import { increaseReusedStringUsedTimes } from "../optimizer/compress";
import { shouldAnalyzeAttributeValue } from "../../util/compiler/assert";
import { analyzeInterpolation, analyzeTemplateAsExpression } from "./interpolation";

export function analyzeEvent(node: TemplateNode, event: TemplateAttribute) {
    const nameLoc = event.name.loc;
    const rawName = event.name.raw;
    const isComponent = !!node.componentTag;
    const parseResult = parseEventFlag(event);
    analyzeResult.template.parsedEvents.set(event, parseResult);
    increaseReusedStringUsedTimes(parseResult.eventName.slice(1), isComponent);

    if (isComponent && rawName !== parseResult.eventName) {
        RedundantEventFlags(
            getLocByIndex(nameLoc.start.index + parseResult.eventName.length, nameLoc.end.index),
        );
    }

    // native 标志表示处理器要拿原生事件、按原生顺序执行，这类事件不进委托注册表
    // The `native` flag means the handler wants the native event and executes
    // in native order; these events do not go into the delegation registry.
    const delegateEventName = parseResult.eventName.slice(1);
    if (
        !isComponent &&
        !(parseResult.generalFlag.value & EVENT_NATIVE) &&
        DELEGATABLE_EVENTS.has(delegateEventName)
    ) {
        const passive = parseResult.generalFlag.value & EVENT_PASSIVE;
        analyzeResult.template.delegateEvents[passive ? "passive" : "nonPassive"].add(
            delegateEventName,
        );
    }

    // 同名简写语法，更新顶级作用域标识符的响应性状态
    // For shorthand properties with the same name, update the reactive status of the corresponding top-level scope identifier.
    if (!event.equalSign) {
        const eventNameLoc = getLocByIndex(
            nameLoc.start.index,
            nameLoc.start.index + parseResult.eventName.length,
        );
        analyzeTemplateAsExpression(
            node,
            parseResult.eventName,
            event,
            eventNameLoc,
            AnalyzeExpressionType.Attribute,
        );
    }

    if (shouldAnalyzeAttributeValue(event)) {
        analyzeInterpolation(node, event, event.value.raw, event.value.loc.start.index);
    }
}
