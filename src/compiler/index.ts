import { LSC, SPREAD_TAG, PRESERVED_IDPREFIX } from "./constants"

import {
    isVoidTag,
    isEmbeddedStyleTag,
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

import type {
    Camel2KebabFunc,
    Kebab2CamelFunc,
    ToPropertyKeyFunc,
    FindEndBracketFunc,
    FormatSourceCodeFunc,
    FindOutOfCommentFunc,
    FindOutOfLiteralFunc,
    FindOutOfLiteralCommentFunc
} from "#type-declarations/compiler-ex"

export type {
    ASTLocation,
    ASTPosition,
    TemplateNode,
    TypeScriptApi,
    CompileOptions,
    CompileResult,
    StyleDescriptor,
    TextContentPart,
    ScriptDescriptor,
    TemplateAttribute,
    ASTPositionWithFlag,
    TemplateNodeContext,
    CompileIntermediateOptions
} from "#type-declarations/compiler"

export type { CompileIntermediateResult } from "./compile"

export const util: {
    isVoidTag: typeof isVoidTag
    camel2Kebab: Camel2KebabFunc
    kebab2Camel: Kebab2CamelFunc
    toPropertyKey: ToPropertyKeyFunc
    findEndBracket: FindEndBracketFunc
    findOutOfComment: FindOutOfCommentFunc
    findOutOfLiteral: FindOutOfLiteralFunc
    formatSourceCode: FormatSourceCodeFunc
    isEmbeddedStyleTag: typeof isEmbeddedStyleTag
    isEmbeddedLanguageTag: typeof isEmbeddedLanguageTag
    findOutOfLiteralComment: FindOutOfLiteralCommentFunc
    isRequiredValueDirective: typeof isRequiredValueDirective
} = {
    isVoidTag,
    camel2Kebab,
    kebab2Camel,
    toPropertyKey,
    findEndBracket,
    findOutOfComment,
    findOutOfLiteral,
    formatSourceCode,
    isEmbeddedStyleTag,
    isEmbeddedLanguageTag,
    findOutOfLiteralComment,
    isRequiredValueDirective
}

export const constants = {
    LSC,
    SPREAD_TAG,
    PRESERVED_IDPREFIX
}

export {
    TestingMode,
    PositionFlag,
    InlayHintKind,
    ReactivityMode,
    WhitespaceMode,
    IdentifierStatus,
    CompileMessageType,
    AttributeValueEnclosure
} from "./enums"
export { isCompileError } from "./message/error"
export { isCompileWarning } from "./message/warn"
export { parseDirectiveValue } from "./parser/directive"
export { compile, compileIntermediate } from "./compile"
export { getTypeScript, setTypeScript, setTypeScriptPath } from "./ts-api"
export { parseEventFlagStandalone as parseEventFlag } from "./parser/event"
export { parseTemplateStandalone as parseTemplate } from "./parser/template"
