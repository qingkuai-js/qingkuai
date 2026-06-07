import type { TemplateAttribute, TemplateNode } from "#type-declarations/compiler"

import {
    nonWhitespaceRE,
    embeddedLangTagRE,
    jsValidIdentifierRE,
    embeddedStyleLangRE
} from "../../compiler/regular"
import {
    VOID_TAGS,
    JS_RESERVED_KEYWORDS,
    REQUIRED_VALUE_DIRECTIVES
} from "../../compiler/constants"
import { findOutOfComment } from "./string"
import { isEmptyString } from "../shared/assert"
import { getTemplateNodeContext } from "./template"

export function isVoidTag(tag: string) {
    return VOID_TAGS.has(tag)
}

export function isEmbeddedLanguageTag(tag: string) {
    return embeddedLangTagRE.test(tag)
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

export function isEmbeddedStyleTag(tag: string) {
    return tag.startsWith("lang-") && embeddedStyleLangRE.test(tag.slice(5))
}

export function isValidIdentifierName(name: string, allowReserved = false) {
    return jsValidIdentifierRE.test(name) && (allowReserved || !JS_RESERVED_KEYWORDS.has(name))
}
