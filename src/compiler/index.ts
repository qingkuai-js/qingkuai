import {
    SPREAD_TAG,
    PRESERVED_IDPREFIX,
    LANGUAGE_SERVICE_UTIL,
    GET_TYPE_DELAY_MARKING
} from "./constants"

import {
    isSelfClosingTag,
    isEmbeddedLanguageTag,
    isRequiredValueDirective
} from "../util/compiler/assert"

import {
    camel2Kebab,
    kebab2Camel,
    toPropertyKey,
    findEndBracket,
    findOutOfComment,
    findOutOfLiteral,
    findOutOfLiteralComment
} from "../util/compiler/string"

export type {
    ASTLocation,
    ASTPosition,
    TemplateNode,
    CompileOptions,
    StyleDescriptor,
    ScriptDescriptor,
    IdentifierStatus,
    TemplateAttribute,
    ASTPositionWithFlag
} from "#type-declarations/compiler"

export type { CompileIntermediateResult } from "./compile"

export const util = {
    camel2Kebab,
    kebab2Camel,
    toPropertyKey,
    findEndBracket,
    findOutOfComment,
    findOutOfLiteral,
    isSelfClosingTag,
    isEmbeddedLanguageTag,
    findOutOfLiteralComment,
    isRequiredValueDirective
}

export const constants = {
    SPREAD_TAG,
    PRESERVED_IDPREFIX,
    LANGUAGE_SERVICE_UTIL,
    GET_TYPE_DELAY_MARKING
}

export { PositionFlag } from "./enums"
export { isCompileError } from "./message/error"
export { isCompileWarning } from "./message/warn"
export { parseComponentTag } from "./parser/component"
export { parseDirectiveValue } from "./parser/directive"
export { compile, compileIntermediate } from "./compile"
export { parseEventFlagStandalone as parseEventFlag } from "./parser/event"
export { parseTemplateStandalone as parseTemplate } from "./parser/template"
