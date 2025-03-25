import {
    camel2Kebab,
    kebab2Camel,
    findEndBracket,
    findOutOfString,
    findOutOfComment,
    findOutOfStringComment
} from "../util/compiler/strings"
import {
    isSelfClosingTag,
    isEmbededLanguageTag,
    mustDirectiveHasValue
} from "../util/compiler/sundry"
export { compile } from "./compile"
export { commonMessage } from "./message/common"
export { isCompileError } from "./message/error"
export { isCompileWarning } from "./message/warn"
export { PositionFlag } from "../util/shared/flag"
import { parseTemplateStandalone } from "./parser/template"

export const util = {
    kebab2Camel,
    camel2Kebab,
    findEndBracket,
    findOutOfString,
    findOutOfComment,
    isSelfClosingTag,
    isEmbededLanguageTag,
    mustDirectiveHasValue,
    findOutOfStringComment
}
export const parseTemplate = parseTemplateStandalone

// types
export type { PositionFlagKeys } from "../util/types"

// prettier-ignore
export type { SlotInfo, ASTLocation, ASTPosition, TemplateNode, CompileResult, CompileOptions, ASTPositionWithFlag} from "./types"
