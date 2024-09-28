import type { FindOutOfSC, FixedArray, StartBracket } from "../types"

import { isString, isUndefined } from "../shared/assert"

// 脱离字符串和注释范围从js代码中查找指定子串
// 这是一个重载函数，当未传入startIndex时它只返回匹配子串的开始索引
// 当传入了startIndex时，它将返回一个由两个number组成的数组，格式：[匹配子串开始索引，匹配子串长度]
export const findOutOfSC: FindOutOfSC = (
    str: string,
    pattern: string | RegExp,
    startIndex?: number
): any => {
    const withoutStartIndex = isUndefined(startIndex)
    if (withoutStartIndex) {
        startIndex = 0
    }

    // 根据是否传入了startIndex返回正确的重载返回值
    const cr = (index: number, len: number) => {
        if (withoutStartIndex) {
            return index
        } else {
            return [index, len] as FixedArray<number, 2>
        }
    }

    // ls代表剩余未查询部分的字符串
    for (let i = startIndex!, ls = str.slice(i); i < str.length; i++, ls = str.slice(i)) {
        if (/^['"`]/.test(str[i])) {
            const endChar = str[i]
            while (str[++i] !== endChar) {
                if ("\\" === str[i]) {
                    i++
                    continue
                }
                if (i >= str.length) {
                    return cr(-1, 0)
                }
            }
            ls = str.slice(++i)
        }

        if (ls.startsWith("//")) {
            const endIndex = ls.indexOf("\n")
            if (endIndex === -1) {
                return cr(-1, 0)
            }
            i += endIndex
            continue
        }

        if (ls.startsWith("/*")) {
            const endIndex = ls.indexOf("*/")
            if (endIndex === -1) {
                return cr(-1, 0)
            }
            i += endIndex
            continue
        }

        if (isString(pattern)) {
            if (ls.startsWith(pattern)) {
                return cr(i, pattern.length)
            }
        } else {
            const re = new RegExp(pattern)
            const matched = re.exec(ls)
            if (matched) {
                return cr(i + matched.index, matched[0].length)
            }
        }
    }

    return cr(-1, 0)
}

// 在表达式中找到关闭括号的位置， 使用此方法时，startIndex应为开始括号的下一个位置
export function findEndCurlyBracket(str: string, startIndex: number, char: StartBracket = "{") {
    const pairMap = { "{": "}", "[": "]", "(": ")" }

    while (true) {
        const [startBracketIndex] = findOutOfSC(str, char, startIndex)
        const [endBracketIndex] = findOutOfSC(str, pairMap[char], startIndex)
        if (endBracketIndex === -1) {
            return -1
        }
        if (startBracketIndex === -1 || endBracketIndex < startBracketIndex) {
            return endBracketIndex
        }
        startIndex = endBracketIndex + 1
    }
}
