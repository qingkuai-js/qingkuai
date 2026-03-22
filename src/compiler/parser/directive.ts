import type { ContextPattern } from "#type-declarations/estree"
import type { CompileMessage, TemplateAttribute } from "#type-declarations/compiler"
import type { ParseDirectiveValueFunc } from "#type-declarations/compiler-ex"

import { walkEstree } from "../estree/walk"
import { parseContextPattern } from "./script"
import { inputDescriptor, messages } from "../state"
import { findOutOfLiteralComment } from "../../util/compiler/string"
import { InvalidContextPattern } from "../message/error"
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
    const rawValue = directive.value.raw
    const startSourceIndex = directive.value.loc.start.index

    const notKeywordReturns = {
        base: rawValue,
        patterns: [],
        keywordIndex: -1,
        baseStartSourceIndex: startSourceIndex
    }

    if (rawName !== "#for" && rawName !== "#slot") {
        return notKeywordReturns
    }

    const keyword = { "#for": "of", "#slot": "from" }[rawName]
    const [findTarget, findLength] = [` ${keyword} `, keyword.length + 2]

    for (let i = 0; i < rawValue.length; i += findLength - 1) {
        if (-1 === (i = findOutOfLiteralComment(rawValue, findTarget, i))) {
            return notKeywordReturns
        }

        const pattern = parseContextPattern(`[${rawValue.slice(0, i)}]`)
        if (pattern?.type !== "ArrayPattern" || !pattern.elements.length) {
            continue
        }

        const baseStartIndex = i + findLength
        const base = rawValue.slice(baseStartIndex)
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
                case "ObjectPattern":
                case "RestElement": {
                    patterns.push(element)
                    continue
                }
                default: {
                    InvalidContextPattern(
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

    return notKeywordReturns
}

export const parseDirectiveValueStandalone: ParseDirectiveValueFunc = (
    directive: TemplateAttribute
) => {
    const isCheckMode = inputDescriptor.options.checkMode
    const originMessageLen = messages.length
    inputDescriptor.options.checkMode = true

    const ret = parseDirectiveValue(directive)
    inputDescriptor.options.checkMode = isCheckMode

    let parseMessages: CompileMessage[] | undefined = undefined
    if (originMessageLen !== messages.length) {
        parseMessages = messages.slice(originMessageLen)
    }
    if (parseMessages?.length) {
        ret.messages = parseMessages
    }
    return ret
}
