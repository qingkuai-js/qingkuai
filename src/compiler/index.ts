import {
    isSelfClosingTag,
    isBannedIdentifier,
    isEmbededLanguageTag,
    mustDirectiveHasValue,
    getContextIdentifiers
} from "../util/compiler/sundry"
import {
    camel2Kebab,
    kebab2Camel,
    findEndBracket,
    findOutOfString,
    findOutOfComment,
    findOutOfStringComment
} from "../util/compiler/strings"
import { parseTemplateStandalone } from "./parser/template"

export type {
    SlotInfo,
    ASTLocation,
    ASTPosition,
    TemplateNode,
    CompileResult,
    CompileOptions,
    StyleDescriptor,
    ScriptDescriptor,
    TemplateAttribute,
    ASTPositionWithFlag
} from "./types"

export { compile } from "./compile"
export { commonMessage } from "./message/common"
export { isCompileError } from "./message/error"
export { isCompileWarning } from "./message/warn"
export { PositionFlag } from "../util/shared/flag"

export const util = {
    kebab2Camel,
    camel2Kebab,
    findEndBracket,
    findOutOfString,
    findOutOfComment,
    isSelfClosingTag,
    isBannedIdentifier,
    isEmbededLanguageTag,
    getContextIdentifiers,
    mustDirectiveHasValue,
    findOutOfStringComment
}
export const parseTemplate = parseTemplateStandalone

// types
export type { PositionFlagKeys } from "../util/types"
