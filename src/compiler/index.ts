import {
    isSelfClosingTag,
    isEmbeddedLanguageTag,
    isRequiredValueDirective
} from "../util/compiler/assert"
import {
    isPositionFlagSetAtPos,
    isPositionFlagSetInLoc,
    isPositionFlagSetAtIndex
} from "../util/compiler/position"

import {
    camel2Kebab,
    kebab2Camel,
    findEndBracket,
    findOutOfComment,
    findOutOfLiteral,
    findOutOfLiteralComment
} from "../util/compiler/string"
import {
    getParsedEventInfo,
    getTemplateNodeContext,
    getTemplateContextIdentifiers
} from "../util/compiler/template"

export type {
    ASTLocation,
    ASTPosition,
    TemplateNode,
    CompileResult,
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
    getParsedEventInfo,
    isEmbeddedLanguageTag,
    getTemplateNodeContext,
    isPositionFlagSetInLoc,
    isPositionFlagSetAtPos,
    findOutOfLiteralComment,
    isPositionFlagSetAtIndex,
    isRequiredValueDirective,
    getTemplateContextIdentifiers
}

export { compile } from "./compile"
export { PositionFlag } from "./enums"
export { isCompileError } from "./message/error"
export { isCompileWarning } from "./message/warn"
export { getTemplateContextIdentifiers } from "../util/compiler/template"
export { parseTemplateStandalone as parseTemplate } from "./parser/template"
