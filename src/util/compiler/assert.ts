import type { TemplateAttribute } from "#type-declarations/compiler"
import { nonWhitespaceRE } from "../../compiler/regular"

import { findOutOfComment } from "./string"

export function isAttributeValid(attr: TemplateAttribute) {
    if (!attr.equalSign) {
        return true
    }
    if (attr.valueEnclosure !== "none") {
        return false
    }
    return attr.value.loc.end.index !== attr.loc.end.index
}

export function isNonEmptyExpression(exp: string) {
    return findOutOfComment(exp, nonWhitespaceRE)[0] !== -1
}
