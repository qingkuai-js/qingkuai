import ts from "typescript"
import { LSC, SPREAD_TAG, PRESERVED_IDPREFIX } from "./constants"

import {
    isSelfClosingTag,
    isEmbeddedLanguageTag,
    isRequiredValueDirective
} from "../util/compiler/assert"
import { formatSourceCode } from "../util/shared/sundry"

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
    CompileResult,
    StyleDescriptor,
    TextContentPart,
    ScriptDescriptor,
    IdentifierStatus,
    TemplateAttribute,
    ASTPositionWithFlag,
    TemplateNodeContext,
    CompileIntermediateOptions
} from "#type-declarations/compiler"

export type { CompileIntermediateResult } from "./compile"

export const util = {
    ts,
    camel2Kebab,
    kebab2Camel,
    toPropertyKey,
    findEndBracket,
    findOutOfComment,
    findOutOfLiteral,
    isSelfClosingTag,
    formatSourceCode,
    isEmbeddedLanguageTag,
    findOutOfLiteralComment,
    isRequiredValueDirective
}

export const constants = {
    LSC,
    SPREAD_TAG,
    PRESERVED_IDPREFIX
}

export { PositionFlag } from "./enums"
export { isCompileError } from "./message/error"
export { isCompileWarning } from "./message/warn"
export { parseDirectiveValue } from "./parser/directive"
export { compile, compileIntermediate } from "./compile"
export { parseEventFlagStandalone as parseEventFlag } from "./parser/event"
export { parseTemplateStandalone as parseTemplate } from "./parser/template"
