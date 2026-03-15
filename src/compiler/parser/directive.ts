import type { ArrayPattern } from "@babel/types"
import type { ContextPattern } from "#type-declarations/estree"
import type { TemplateAttribute } from "#type-declarations/compiler"
import type { ParseDirectiveValueFunc } from "#type-declarations/compiler-ex"

import { walkEstree } from "../estree/walk"
import { inputDescriptor } from "../state"
import { parseContextPattern } from "./script"
import { findOutOfLiteralComment } from "../../util/compiler/string"
import { InvalidContextPatternForDirective } from "../message/error"
import { getNonWhitespaceLocByIndex } from "../../util/compiler/position"

// 解析指令值：此方法主要用于解析格式为 模式 + 关键字 + 表达式 的指令值，目前值为此格式的指令有：#slot 和 #for
// Parse directive values: this method is mainly used to parse directive values in the format `pattern + keyword + expression`.
// Currently, directives with this format include `#slot` and `#for`.
//
// 解析时会跳过字面量和注释范围查找关键字，当关键字前方的模式可以被正确解析时视为解析成功，否则整个指令值被认作表达式
// During parsing, literals and comment ranges are skipped when searching for the keyword. Parsing is considered successful
// if the pattern before the keyword can be correctly parsed; otherwise, the entire directive value is treated as an expression.
export const parseDirectiveValue: ParseDirectiveValueFunc = (directive: TemplateAttribute) => {
    const rawName = directive.name.raw
    if (rawName !== "#for" && rawName !== "#slot") {
        return
    }

    const source = directive.value.raw
    const startSourceIndex = directive.value.loc.start.index
    const keyword = { "#for": "of", "#slot": "from" }[rawName]
    const [findTarget, findLength] = [` ${keyword} `, keyword.length + 2]

    for (let i = 0; true; i += findLength - 1) {
        if (-1 === (i = findOutOfLiteralComment(source, findTarget, i))) {
            return {
                base: source,
                patterns: [],
                keywordIndex: -1,
                baseStartSourceIndex: startSourceIndex
            }
        }
        const pattern = parseContextPattern(`[${source.slice(0, i)}]`) as ArrayPattern | null
        if (pattern) {
            if (!pattern.elements.length) {
                continue
            }

            const baseStartIndex = i + findLength
            const base = source.slice(baseStartIndex)
            if (
                pattern.extra &&
                "trailingComma" in pattern.extra &&
                base.trimStart().startsWith(keyword)
            ) {
                continue
            }

            // 由于解析时添加了一个开始中括号前缀，这里需要将每个节点的位置信息向前移动一位
            // Since a prefix '[' was added during parsing, the position of each node needs to be shifted forward by one here.
            walkEstree(pattern, {
                AnyNode(node) {
                    if (!node.loc.end.column) {
                        node.loc.end.column--
                    }
                    if (!node.loc.start.column) {
                        node.loc.start.column--
                    }
                    node.loc.end.index = node.range[1] = --node.end
                    node.loc.start.index = node.range[0] = --node.start
                }
            })

            // ArrayPattern 中的元素需要满足 ContextPattern 类型才视为有效
            // Elements in an ArrayPattern must satisfy the ContextPattern type to be considered valid.
            const patterns: (ContextPattern | null)[] = []
            for (const element of pattern.elements) {
                switch (element?.type) {
                    case undefined:
                    case "Identifier":
                    case "ArrayPattern":
                    case "ObjectPattern": {
                        patterns.push(element)
                        continue
                    }
                    default: {
                        InvalidContextPatternForDirective(
                            getNonWhitespaceLocByIndex(
                                element!.start! + startSourceIndex,
                                element!.end! + startSourceIndex
                            )
                        )
                    }
                }
            }

            return {
                base,
                patterns,
                keywordIndex: i,
                baseStartSourceIndex: startSourceIndex + baseStartIndex
            }
        }
    }
}

export const parseDirectiveValueStandalone: ParseDirectiveValueFunc = (...args) => {
    const { checkMode } = inputDescriptor.options
    const ret = parseDirectiveValue(...args)
    return ((inputDescriptor.options.checkMode = checkMode), ret)
}
