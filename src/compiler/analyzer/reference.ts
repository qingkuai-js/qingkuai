import type { TemplateAttribute, TemplateNode } from "#type-declarations/compiler"

import { analyzeResult } from "../state"
import { SPREAD_TAG } from "../constants"
import { isLeftValue } from "../estree/assert"
import { DomRerferenceAttributeOnComponent } from "../message/warn"
import { increaseCommonStringCount } from "../../util/compiler/sundry"
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
    if (target && isLeftValue(target)) {
        if (checkResult) {
            analyzeResult.template.validReferenceAttributes.add(attribute)
        }
    } else {
        InvalidReferenceAttributeValue(getNonWhiteSpaceLocByLoc(attribute.value.loc))
    }
}

function checkReferenceAttribute(node: TemplateNode, attribute: TemplateAttribute) {
    const tag = node.tag
    const allowedList = ["&dom"]
    const rawName = attribute.name.raw
    const nameLoc = attribute.name.loc

    const localInvalidReferenceAttribute = (tag: string) => {
        InvalidReferenceAttribute(nameLoc, tag, rawName, allowedList)
    }

    if (node.componentTag) {
        if (rawName === "&dom") {
            DomRerferenceAttributeOnComponent(nameLoc)
        }
        return true
    }
    switch (tag) {
        case "slot":
        case SPREAD_TAG: {
            return false
        }
        case "select":
        case "textarea": {
            allowedList.push("&value")
            break
        }
        case "input": {
            allowedList.push("&value", "&number", "&checked", "&group")
            break
        }
    }
    if (allowedList.includes(rawName)) {
        switch (rawName) {
            case "&number": {
                increaseCommonStringCount("input")
                break
            }
            case "&group":
            case "&checked": {
                increaseCommonStringCount("change")
                break
            }
            case "&value": {
                increaseCommonStringCount(tag === "slot" ? "change" : "input")
                break
            }
        }
        return true
    }
    return (localInvalidReferenceAttribute(tag), false)
}
