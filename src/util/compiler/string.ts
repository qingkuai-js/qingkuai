import type {
    Kebab2CamelFunc,
    Camel2KebabFunc,
    ToPropertyKeyFunc,
    FindEndBracketFunc,
    FindOutOfLiteralFunc,
    FindOutOfCommentFunc,
    FindOutOfLiteralCommentFunc
} from "#type-declarations/compiler-ex"
import type { Range } from "#type-declarations/compiler"

import {
    whitespaceRE,
    kebabWholeRE,
    jsValueCharRE,
    nonWhitespaceRE,
    jsStartRegexKeywordsRE,
    jsStringLiteralQuoteRE,
    kebabWithoutFirstLetterRE
} from "../../compiler/regular"
import { stringify } from "../shared/aliases"
import { isValidIdentifierName } from "./assert"
import { escapeRegExpSource } from "../shared/sundry"
import { isString, isUndefined } from "../shared/assert"

export const findOutOfLiteral: FindOutOfLiteralFunc = findOutOfGen(true, false)
export const findOutOfComment: FindOutOfCommentFunc = findOutOfGen(false, true)
export const findOutOfLiteralComment: FindOutOfLiteralCommentFunc = findOutOfGen(true, true)

export const toPropertyKey: ToPropertyKeyFunc = (str: string) => {
    return isValidIdentifierName(str) ? str : stringify(str)
}

export const findEndBracket: FindEndBracketFunc = (str: string) => {
    const endBracket = { "{": "}", "(": ")", "[": "]", "<": ">" }[str[0]]!
    for (let startIndex = 0; startIndex < str.length; ) {
        const endBracketIndex = findOutOfLiteralComment(str, endBracket, startIndex)
        const startBracketIndex = findOutOfLiteralComment(str, str[0], startIndex + 1)
        if (startBracketIndex === -1 || startBracketIndex > endBracketIndex) {
            return endBracketIndex
        }
        startIndex = startBracketIndex + findEndBracket(str.slice(startBracketIndex)) + 1
    }
    return -1
}

export const camel2Kebab: Camel2KebabFunc = (str: string, allowFullLower = true) => {
    if (!allowFullLower && !/[A-Z]/.test(str.slice(1))) {
        return str
    }
    return str.replace(/[A-Z]/g, (m, i) => {
        return (i === 0 ? "" : "-") + m.toLowerCase()
    })
}

export const kebab2Camel: Kebab2CamelFunc = (str: string, startWithUppercase = false) => {
    return str.replaceAll(startWithUppercase ? kebabWholeRE : kebabWithoutFirstLetterRE, s => {
        return s === "-" ? "" : s.toUpperCase()
    })
}

export function findNonWhitespaceChar(str: string, start: number) {
    while (!nonWhitespaceRE.test(str[start]) && start < str.length) {
        start++
    }
    return start
}

export function findNonWhitespaceCharRight(str: string, start: number) {
    while (start > 0 && !nonWhitespaceRE.test(str[start - 1])) {
        start--
    }
    return start
}

// 生成在脚本源码中脱离指定范围（字符串、注释）查找子串（或正则）的方法
// Generate methods to search for a substring (or RegExp) in script source code,
// excluding matches that appear inside specified ranges (e.g., strings or comments).
function findOutOfGen(outOfLiteral: boolean, outOfComment: boolean) {
    function generated(str: string, substr: string, startIndex?: number): number
    function generated(str: string, pattern: RegExp, startIndex?: number): Range
    function generated(s: string, m: string | RegExp, n?: number): number | Range {
        const mIsString = isString(m)
        const patternSoruce = `^${mIsString ? escapeRegExpSource(m) : m.source}`
        const patternRE = new RegExp(patternSoruce, mIsString ? "" : m.flags)

        // 第二个参数为正则表达式时需要返回匹配项的长度
        // When the second argument is a RegExp, returns the match length
        const reloadedReturn = (index: number, len: number) => {
            return mIsString ? index : ([index, len] as Range)
        }

        for (let i = 0, left = s; i < s.length; left = s.slice(++i)) {
            if (outOfLiteral && jsStringLiteralQuoteRE.test(left[0])) {
                for (
                    const stopChar = s[i];
                    stopChar !== (left = s.slice(++i))[0] && i < s.length;
                ) {
                    if ("\\" === left[0]) {
                        i++
                        continue
                    }
                    if (left[0] === "\n" && stopChar !== "`") {
                        return reloadedReturn(-1, 0)
                    }

                    // 在模板字符串的插值表达式中查找
                    // Search within the interpolation expression of a template string
                    if (stopChar === "`" && left.startsWith("${")) {
                        const temp = findEndBracket(left.slice(1))
                        const endBracketIndex = temp === -1 ? left.length : temp + 1
                        const [matchedIndex, matchedLength] = generated(
                            left.slice(2, endBracketIndex),
                            patternRE,
                            isUndefined(n) ? 0 : n - i - 2
                        )
                        if (matchedIndex === -1) {
                            if (temp !== -1) {
                                i += endBracketIndex
                                continue
                            }
                            return reloadedReturn(-1, 0)
                        }
                        return reloadedReturn(matchedIndex + i + 2, matchedLength)
                    }
                }
                if (i < s.length) {
                    left = s.slice(++i)
                } else {
                    return reloadedReturn(-1, 0)
                }
            }

            if (outOfComment && left.startsWith("//")) {
                const endIndex = left.indexOf("\n")
                if (endIndex === -1) {
                    return reloadedReturn(-1, 0)
                }
                i += endIndex
                continue
            }
            if (outOfComment && left.startsWith("/*")) {
                const endIndex = left.indexOf("*/")
                if (endIndex === -1) {
                    return reloadedReturn(-1, 0)
                }
                i += endIndex + 1
                continue
            }

            if (outOfLiteral && "/" === left[0] && canStartRegex(s, i)) {
                for (
                    let inCharClass = false;
                    ("/" !== (left = s.slice(++i))[0] || inCharClass) && i < s.length;
                ) {
                    if ("\\" === left[0]) {
                        i++
                        continue
                    }
                    if (left[0] === "\n") {
                        return reloadedReturn(-1, 0)
                    }
                    if ("[" === left[0]) {
                        inCharClass = true
                        continue
                    }
                    if (inCharClass && "]" === left[0]) {
                        inCharClass = false
                        continue
                    }
                }
                if (i < s.length) {
                    left = s.slice(++i)
                } else {
                    return reloadedReturn(-1, 0)
                }
            }

            const matched = patternRE.exec(left)
            if (matched && i >= (n ?? -1)) {
                return reloadedReturn(i, matched[0].length)
            }
        }
        return reloadedReturn(-1, 0)
    }
    return generated
}

// 判断字符串指定位置之后是否可以表示正则表达式字面量
function canStartRegex(s: string, i: number, j = i - 1) {
    while (j >= 0 && whitespaceRE.test(s[j])) {
        j--
    }

    if (j < 0) {
        return true
    }

    if (j > 0) {
        switch (s.slice(j - 1, j + 1)) {
            case "==":
            case "!=":
            case "<=":
            case ">=":
            case "&&":
            case "||": {
                return true
            }
            case "++":
            case "--": {
                return false
            }
        }
    }

    switch (s[j]) {
        case "(":
        case "{":
        case "[":
        case ",":
        case ";":
        case ":":
        case "?":
        case "=":
        case "!":
        case "+":
        case "-":
        case "*":
        case "%":
        case "~":
        case "^":
        case "&":
        case "|":
        case "<":
        case ">": {
            return true
        }
        case ")":
        case "]":
        case "}":
        case ".": {
            return false
        }
        default: {
            if (jsValueCharRE.test(s[j])) {
                return false
            }
        }
    }

    return jsStartRegexKeywordsRE.test(s.slice(Math.max(0, j - 5), j + 1))
}
