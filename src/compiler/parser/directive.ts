import type { ParseDirectiveValueFunc } from "#type-declarations/compiler-ex"
import type { CompileMessage, TemplateAttribute } from "#type-declarations/compiler"

import ts from "typescript"

import { parseContextPattern } from "./script"
import { inputDescriptor, messages } from "../state"
import { InvalidContextPattern } from "../message/error"
import { isValidContextPattern } from "../ts-ast/assert"
import { findOutOfLiteralComment } from "../../util/compiler/string"
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

        const pattern = parseContextPattern(rawValue.slice(0, i), startSourceIndex)
        if (!pattern?.elements.length) {
            continue
        }

        const baseStartIndex = i + findLength
        const base = rawValue.slice(baseStartIndex)
        if (pattern && pattern.elements.hasTrailingComma && base.trimStart().startsWith(keyword)) {
            continue
        }

        // ArrayPattern 中的元素需要满足 ContextPattern 类型才视为有效
        // Elements in an ArrayPattern must satisfy the ContextPattern type to be considered valid.
        const patterns: ts.ArrayBindingElement[] = []
        for (const element of pattern.elements) {
            if (isValidContextPattern(element)) {
                patterns.push(element)
            } else {
                InvalidContextPattern(
                    getNonWhitespaceLocByIndex(
                        element.getStart() + startSourceIndex,
                        element.getEnd() + startSourceIndex
                    )
                )
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
