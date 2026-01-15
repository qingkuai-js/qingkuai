import type {
    Kebab2CamelFunc,
    Camel2KebabFunc,
    FindEndBracketFunc,
    FindOutOfStringFunc,
    FindOutOfCommentFunc,
    FindOutOfStringCommentFunc
} from "#type-declarations/exfuncs"
import type { Range } from "#type-declarations/compiler"

import { escapeRegExpSource } from "../shared/sundry"
import { isString, isUndefined } from "../shared/assert"
import { kebabWholeRE, kebabWithoutFirstLetterRE } from "../../compiler/regular"

export const findOutOfString: FindOutOfStringFunc = findOutOfGen(true, false)
export const findOutOfComment: FindOutOfCommentFunc = findOutOfGen(false, true)
export const findOutOfStringComment: FindOutOfStringCommentFunc = findOutOfGen(true, true)

export const findEndBracket: FindEndBracketFunc = (str: string) => {
    const endBracket = { "{": "}", "(": ")", "[": "]" }[str[0]]!
    for (let startIndex = 0; startIndex < str.length; ) {
        const endBracketIndex = findOutOfStringComment(str, endBracket, startIndex)
        const startBracketIndex = findOutOfStringComment(str, str[0], startIndex + 1)
        if (startBracketIndex === -1 || startBracketIndex > endBracketIndex) {
            return endBracketIndex
        }
        startIndex += startBracketIndex + findEndBracket(str.slice(startBracketIndex)) + 1
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
    return str.replace(startWithUppercase ? kebabWholeRE : kebabWithoutFirstLetterRE, s => {
        return s === "-" ? "" : s.toUpperCase()
    })
}

// 生成在脚本源码中脱离指定范围（字符串、注释）查找子串（或正则）的方法
// Generate methods to search for a substring (or RegExp) in script source code,
// excluding matches that appear inside specified ranges (e.g., strings or comments).
function findOutOfGen(outOfString: boolean, outOfComment: boolean) {
    function generated(str: string, substr: string, startIndex?: number): number
    function generated(str: string, pattern: RegExp, startIndex?: number): Range
    function generated(s: string, m: string | RegExp, n?: number): number | Range {
        const pIsString = isString(m)
        const patternSoruce = `^${pIsString ? escapeRegExpSource(m) : m.source}`
        const patternRE = new RegExp(patternSoruce, pIsString ? "" : m.flags)

        // 第二个参数为正则表达式时需要返回匹配项的长度
        // When the second argument is a RegExp, returns the match length
        const reloadedReturn = (index: number, len: number) => {
            return pIsString ? index : ([index, len] as Range)
        }

        for (let i = 0, left = s; i < s.length; left = s.slice(++i)) {
            if (outOfString && /^['"`]/.test(left)) {
                const stopCharacter = s[i]
                while (!(left = s.slice(++i)).startsWith(stopCharacter)) {
                    if ("\\" === left[0]) {
                        i++
                        continue
                    }
                    if (i >= s.length || (left[0] === "\n" && stopCharacter !== "`")) {
                        return reloadedReturn(-1, 0)
                    }

                    // 在模板字符串的插值表达式中查找
                    // Search within the interpolation expression of a template string
                    if (stopCharacter === "`" && left.startsWith("${")) {
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
                left = s.slice(++i)
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

            const matched = patternRE.exec(left)
            if (matched && i >= (n ?? -1)) {
                return reloadedReturn(i, matched[0].length)
            }
        }
        return reloadedReturn(-1, 0)
    }
    return generated
}
