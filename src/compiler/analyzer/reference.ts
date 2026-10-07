import type TS from "typescript"

import type { TemplateAttribute, TemplateNode } from "#type-declarations/compiler"

import ts from "typescript"

import { analyzeResult } from "../state"
import { SPREAD_TAG } from "../constants"
import { getStriptTypeOperationsNode } from "../ts-ast/sundry"
import { isLeftValue, isRawCallExpression } from "../ts-ast/assert"
import { getNonWhiteSpaceLocByLoc } from "../../util/compiler/position"
import { shouldAnalyzeAttributeValue } from "../../util/compiler/assert"
import { analyzeInterpolation, analyzeTemplateAsExpression } from "./interpolation"
import { InvalidReferenceAttribute, InvalidReferenceAttributeValue } from "../message/error"

export function analyzeReferenceAttribute(node: TemplateNode, attribute: TemplateAttribute) {
    const rawName = attribute.name.raw
    const nameLoc = attribute.name.loc
    const checkResult = checkReferenceAttribute(node, attribute)

    // 同名简写语法，更新顶级作用域标识符的响应性状态
    // For shorthand properties with the same name, update the reactive status of the corresponding top-level scope identifier.
    if (!attribute.equalSign) {
        if (checkResult) {
            analyzeResult.template.validReferenceAttributes.add(attribute)
        }
        return analyzeTemplateAsExpression(node, rawName, attribute, nameLoc, "attribute")
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

    // 校验左值时剥掉 raw 包裹，使用内层表达式
    // Unwrap raw to validate the inner expression as the left value.
    const effectiveTarget = target && getUnwrappedRawTarget(target)
    if (effectiveTarget && isLeftValue(effectiveTarget)) {
        if (checkResult) {
            analyzeResult.template.validReferenceAttributes.add(attribute)
        }
    } else {
        InvalidReferenceAttributeValue(getNonWhiteSpaceLocByLoc(attribute.value.loc))
    }
}

function getUnwrappedRawTarget(target: TS.Expression | null) {
    if (!target) {
        return target
    }

    const expression = getStriptTypeOperationsNode(target)
    if (
        isRawCallExpression(expression) &&
        expression.arguments.length === 1 &&
        !ts.isSpreadElement(expression.arguments[0])
    ) {
        return expression.arguments[0]
    }
    return expression
}

function checkReferenceAttribute(node: TemplateNode, attribute: TemplateAttribute) {
    const tag = node.tag
    const allowedList = ["&handle"]
    const rawName = attribute.name.raw
    const nameLoc = attribute.name.loc

    const localInvalidReferenceAttribute = (tag: string) => {
        InvalidReferenceAttribute(nameLoc, tag, rawName, allowedList)
    }

    if (node.componentTag) {
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
        return true
    }
    return (localInvalidReferenceAttribute(tag), false)
}
