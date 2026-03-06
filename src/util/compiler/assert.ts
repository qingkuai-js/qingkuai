import type { TemplateAttribute, TemplateNode } from "#type-declarations/compiler"

import { findOutOfComment } from "./string"
import { isEmptyString } from "../shared/assert"
import { getTemplateNodeContext } from "./template"
import { nonWhitespaceRE, templateEmbeddedLangTagRE } from "../../compiler/regular"
import { REQUIRED_VALUE_DIRECTIVES, SELF_CLOSING_TAGS } from "../../compiler/constants"

export function isSelfClosingTag(tag: string) {
    return SELF_CLOSING_TAGS.has(tag)
}

export function isEmbeddedLanguageTag(tag: string) {
    return templateEmbeddedLangTagRE.test(tag)
}

export function isBlankTextNode(node: TemplateNode) {
    return (
        isEmptyString(node.tag) &&
        node.content.length === 1 &&
        isEmptyString(node.content[0].value.trim())
    )
}

export function isRequiredValueDirective(name: string) {
    return REQUIRED_VALUE_DIRECTIVES.has(name)
}

export function isNonEmptyExpression(exp: string) {
    return findOutOfComment(exp, nonWhitespaceRE)[0] !== -1
}

export function isAttributeValid(attr: TemplateAttribute) {
    return !attr.equalSign || attr.valueEnclosure !== "none"
}

export function shouldAnalyzeAttributeValue(attr: TemplateAttribute) {
    return attr.equalSign && attr.valueEnclosure !== "none"
}

export function isHtmlDirectiveChild(node: TemplateNode) {
    if (!node.parent) {
        return false
    }
    return !!getTemplateNodeContext(node.parent).attributesMap["#html"]
}
