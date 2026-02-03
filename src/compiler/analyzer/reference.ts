import type { TemplateAttribute, TemplateNode } from "#type-declarations/compiler"

import { analyzeResult } from "../state"
import { SPREAD_TAG } from "../constants"
import { DomRerferenceAttributeOnComponent } from "../message/warn"
import { getNonWhiteSpaceLocByLoc } from "../../util/compiler/position"
import { shouldAnalyzeAttributeValue } from "../../util/compiler/assert"
import { analyzeInterpolation, analyzeShorthandAttribute } from "./interpolation"
import { InvalidReferenceAttribute, InvalidReferenceAttributeValue } from "../message/error"

export function analyzeReferenceAttribute(node: TemplateNode, attribute: TemplateAttribute) {
    const checkResult = checkReferenceAttribute(node, attribute)

    // 同名简写语法，更新顶级作用域标识符的响应性状态
    // For shorthand properties with the same name, update the reactive status of the corresponding top-level scope identifier.
    if (!attribute.equalSign) {
        if (checkResult) {
            analyzeResult.template.validReferenceAttributes.add(attribute)
        }
        return analyzeShorthandAttribute(attribute.name.raw, attribute.name.loc)
    }

    if (!shouldAnalyzeAttributeValue(attribute)) {
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

    const localInvalidReferenceAttribute = (tag: string, reasonAttr?: string, extra?: string) => {
        return (InvalidReferenceAttribute(nameLoc, tag, rawName, reasonAttr, extra), false)
    }

    if (node.componentTag) {
        if (rawName === "&dom") {
            DomRerferenceAttributeOnComponent(nameLoc)
        }
        return true
    }

    // <slot> 及 <qk:spread> 上不能使用 &dom
    // The `<slot>` and `<qk:spread>` elements cannot use `&dom`.
    if (SPREAD_TAG === tag || "slot" === tag) {
        return false
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
        return localInvalidReferenceAttribute(tag, undefined, "value")
    }

    if (tag === "input") {
        const typeAttr = nodeInfo.attributesMap["type"]
        const isReferenceType = typeAttr && "&" === typeAttr.name.raw[0]

        // 具有动态 type 属性的 input 只接受 &dom 作为引用属性
        // An input element with a dynamic `type` attribute only accepts the `&dom` as reference attribute.
        if ("!" === typeAttr?.name.raw[0]) {
            return localInvalidReferenceAttribute(tag, "type")
        }

        // input 作为单选框或复选框时允许 &checked 属性，其他情况仅接受 &value 作为引用属性
        // When an input element is a radio button or checkbox, the `&checked` attribute is allowed;
        // otherwise, only accepts `&value` as reference attribute.
        if (
            !isReferenceType &&
            ("radio" === typeAttr?.value.raw || "checkbox" === typeAttr?.value.raw)
        ) {
            const fullTag = `input type="${typeAttr.value.raw}"`
            if (rawName !== "&checked") {
                return localInvalidReferenceAttribute(fullTag, undefined, "checked")
            }
        } else if (rawName !== "&value") {
            const fullTag = `input type="${!typeAttr || isReferenceType ? "text" : typeAttr.value.raw}"`
            return localInvalidReferenceAttribute(fullTag, undefined, "value")
        }
        return true
    }

    if (tag === "select") {
        // 具有动态 multiple 属性的 select 只接受 &dom 作为引用属性
        // A select element with a dynamic `multiple` attribute only accepts the `&dom` as reference attribute.
        if ("!" === nodeInfo.attributesMap["multiple"]?.name.raw[0]) {
            return localInvalidReferenceAttribute(tag, "multiple")
        }

        // select 仅允许 &value 作为引用属性
        // A select element only allows the `&value` as reference attribute.
        if (rawName === "&value") {
            return true
        }
        return localInvalidReferenceAttribute(tag, undefined, "value")
    }

    return localInvalidReferenceAttribute(tag)
}
