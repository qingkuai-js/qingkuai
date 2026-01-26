import type { TemplateAttribute } from "#type-declarations/compiler"

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

export function attributeHasNonEmptyValue(attr: TemplateAttribute) {
    return findOutOfComment(attr.value.raw, /\S/)[0] !== -1
}
