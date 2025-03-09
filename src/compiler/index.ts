export { compile } from "./compile"
export { commonMessage } from "./message/common"
export { isCompileError } from "./message/error"
export { isCompileWarning } from "./message/warn"
export { PositionFlag } from "../util/shared/flag"
import { parseTemplateStandalone } from "./parser/template"
import { isEmbededLanguageTag } from "../util/compiler/sundry"
import { camel2Kebab, findEndBracket, findOutOfSC, kebab2Camel } from "../util/compiler/strings"

export const parseTemplate = parseTemplateStandalone
export const util = { findEndBracket, findOutOfSC, kebab2Camel, camel2Kebab, isEmbededLanguageTag }

// types
export type { PositionFlagKeys } from "../util/types"

// prettier-ignore
export type { SlotInfo, ASTLocation, ASTPosition, TemplateNode, CompileResult, CompileOptions, ASTPositionWithFlag} from "./types"
