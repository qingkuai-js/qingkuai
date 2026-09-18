import type { Range, RawArgumentInfo } from "#type-declarations/compiler"

import ts from "typescript"

import { analyzeResult } from "../state"
import { getStriptTypeOperationsNode } from "../ts-ast/sundry"

// raw 实参的静态分类（topLevelRefs：顶部作用域标识符引用的位置位图）：
// - "plain"：raw/literal/pending 标识符，直接读取。
// - "unwrap"：reactive/shallow 或非顶部作用域标识符，读取原始标识符并由 toRaw 解包；
// 返回 undefined：derived/alias 或非标识符实参交由调用方包装为 noTrackingToRaw；
// 实参非法（无参/多参/spread）同样返回 undefined，由调用方跳过。
//
// Static classification of `raw` arguments (topLevelRefs: a position bitmap of top-level
// identifier references):
// - "unwrap": reactive/shallow or non-top-level identifiers, read as the raw identifier
//   and unwrapped by toRaw;
// - "plain": raw/literal/pending identifiers, read directly.
// undefined means the call is wrapped as noTrackingToRaw by the caller (derived/alias
// identifiers and non-identifier arguments), or is invalid (zero/multiple/spread
// arguments) and is skipped by the caller.
export function getRawArgumentInfo(
    call: ts.CallExpression,
    topLevelRefs: Uint8Array
): RawArgumentInfo | undefined {
    if (call.arguments.length !== 1 || ts.isSpreadElement(call.arguments[0])) {
        return undefined
    }

    const arg = getStriptTypeOperationsNode(call.arguments[0])
    if (!ts.isIdentifier(arg)) {
        return undefined
    }

    const range: Range = [arg.getStart(), arg.getEnd()]
    if (!topLevelRefs[range[0]]) {
        return { kind: "unwrap", range }
    }

    const status = analyzeResult.script.topLevelIdentifiers[arg.text]?.status
    if (status === "raw" || status === "literal" || status === "pending") {
        return { kind: "plain", range }
    }
    if (status === "derived" || status === "alias") {
        return undefined
    }
    return { kind: "unwrap", range }
}
