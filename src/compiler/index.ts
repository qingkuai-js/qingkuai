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
    TemplateAttribute,
    ASTPositionWithFlag
} from "../types/compiler"

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

export { compile } from "./compile"
export { PositionFlag } from "./enums"
export { isCompileError } from "./message/error"
export { isCompileWarning } from "./message/warn"
export { parseTemplateStandalone as parseTemplate } from "./parser/template"
