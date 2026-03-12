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
} from "../types/compiler"

export type { CompileIntermediateResult } from "./compile"

export const util = {
    camel2Kebab,
    kebab2Camel,
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
export { compile, compileIntermediate } from "./compile"
export { parseTemplateStandalone as parseTemplate } from "./parser/template"
