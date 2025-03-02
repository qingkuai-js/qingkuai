import { parseTemplateStandalone } from "./parser/template"
import { camel2Kebab, findEndBracket, findOutOfSC, kebab2Camel } from "../util/compiler/strings"

export type {
    SlotInfo,
    ASTLocation,
    ASTPosition,
    TemplateNode,
    CompileResult,
    CompileOptions
} from "./types"
export type { PositionFlagKeys } from "../util/types"

export { compile } from "./compile"
export { commonMessage } from "./message/common"
export { isCompileError } from "./message/error"
export { isCompileWarning } from "./message/warn"
export { PositionFlag } from "../util/shared/flag"

export const parseTemplate = parseTemplateStandalone
export const util = { findEndBracket, findOutOfSC, kebab2Camel, camel2Kebab }
