import type { TemplateAttribute, TemplateNode } from "#type-declarations/compiler"

import {
    InvalidReferenceAttribute,
    InvalidReferenceAttributeValue,
    InvalidReferenceAttributePlacement
} from "../message/error"
import { analyzeResult } from "../state"
import { SPREAD_TAG } from "../constants"
import { analyzeInterpolation } from "./interpolation"
import { DomRerferenceAttributeOnComponent } from "../message/warn"
import { getNonWhiteSpaceLocByLoc } from "../../util/compiler/position"

export function analyzeReferenceAttribute(node: TemplateNode, attribute: TemplateAttribute) {
    const checkResult = checkReferenceAttribute(node, attribute)
    if (!attribute.equalSign || attribute.valueEnclosure === "none") {
        return
    }

    const target = analyzeInterpolation(
        node,
        attribute,
        attribute.value.raw,
        attribute.value.loc.start.index
    )
    switch (target?.type) {
        case undefined: {
            return
        }
        case "Identifier":
        case "MemberExpression":
        case "TSNonNullExpression": {
            if (checkResult) {
                analyzeResult.template.validReferenceAttributes.add(attribute)
            }
            return
        }
        default: {
            return InvalidReferenceAttributeValue(getNonWhiteSpaceLocByLoc(attribute.value.loc))
        }
    }
}

function checkReferenceAttribute(node: TemplateNode, attribute: TemplateAttribute) {
    const tag = node.tag
    const rawName = attribute.name.raw
    const nameLoc = attribute.name.loc
    const nodeInfo = analyzeResult.template.nodeInfos.get(node)!

    if (node.componentTag) {
        if (rawName === "&dom") {
            DomRerferenceAttributeOnComponent(nameLoc)
        }
        return true
    }

    // <slot> 及 <qk:spread> 上不能使用 &dom
    // The `<slot>` and `<qk:spread>` elements cannot use `&dom`.
    if (SPREAD_TAG === tag || "slot" === tag) {
        return (InvalidReferenceAttributePlacement(nameLoc, tag), false)
    }

    if (rawName === "&dom") {
        return true
    }

    // textarea 仅允许 &value 作为引用属性
    // A textarea element only allows the `&value` as reference attribute.
    if (tag === "textarea") {
        if (rawName === "&value") {
            return true
        }
        return (InvalidReferenceAttribute(nameLoc, tag, undefined, "value"), false)
    }

    if (tag === "input") {
        const typeAttr = nodeInfo.attributesMap["type"]
        const isReferenceType = typeAttr && "&" === typeAttr.name.raw[0]

        // 具有动态 type 属性的 input 只接受 &dom 作为引用属性
        // An input element with a dynamic `type` attribute only accepts the `&dom` as reference attribute.
        if ("!" === typeAttr?.name.raw[0]) {
            return (InvalidReferenceAttribute(nameLoc, tag, "type"), false)
        }

        // input 作为单选框或复选框时允许 &checked 属性，其他情况仅接受 &value 作为引用属性
        // When an input element is a radio button or checkbox, the `&checked` attribute is allowed;
        // otherwise, only accepts `&value` as reference attribute.
        if (
            !isReferenceType &&
            ("radio" === typeAttr.value.raw || "checkbox" === typeAttr.value.raw)
        ) {
            const fullTag = `input type="${typeAttr.value.raw}"`
            if (rawName !== "&checked") {
                return (InvalidReferenceAttribute(nameLoc, fullTag, undefined, "checked"), false)
            }
        } else if (rawName !== "&value") {
            const fullTag = `input type="${isReferenceType ? "text" : typeAttr.value.raw}"`
            return (InvalidReferenceAttribute(nameLoc, fullTag, undefined, "value"), false)
        }
        return true
    }

    if (tag === "select") {
        // 具有动态 multiple 属性的 select 只接受 &dom 作为引用属性
        // A select element with a dynamic `multiple` attribute only accepts the `&dom` as reference attribute.
        if ("!" === nodeInfo.attributesMap["multiple"]?.name.raw[0]) {
            return (InvalidReferenceAttribute(nameLoc, tag, "multiple"), false)
        }

        // select 仅允许 &value 作为引用属性
        // A select element only allows the `&value` as reference attribute.
        if (rawName === "&value") {
            return true
        }
        return (InvalidReferenceAttribute(nameLoc, tag, undefined, "value"), false)
    }

    return (InvalidReferenceAttribute(nameLoc, tag), false)
}
