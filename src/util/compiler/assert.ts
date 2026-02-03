import type { TemplateAttribute } from "#type-declarations/compiler"

import { findOutOfComment } from "./string"
import { nonWhitespaceRE } from "../../compiler/regular"

export function isNonEmptyExpression(exp: string) {
    return findOutOfComment(exp, nonWhitespaceRE)[0] !== -1
}

export function isAttributeValid(attr: TemplateAttribute) {
    return !attr.equalSign || attr.valueEnclosure !== "none"
}

export function shouldAnalyzeAttributeValue(attr: TemplateAttribute) {
    return attr.equalSign && attr.valueEnclosure !== "none"
}
