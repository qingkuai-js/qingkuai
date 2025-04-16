import type { NumNum, StartBracket } from "../types"

import {
    kebabWholeRE,
    stringLiteralConstantRE,
    kebabWithoutFirstLetterRE
} from "../../compiler/regular"
import { isString, isUndefined } from "../shared/assert"
import { inputDescriptor, stringConstants, stringConstantsSourceMap } from "../../compiler/state"

export const findOutOfString = findOutOfGen(true, false)
export const findOutOfComment = findOutOfGen(false, true)
export const findOutOfStringComment = findOutOfGen(true, true)

// JSON.stringify别名
export function normalStringify(v: any) {
    return JSON.stringify(v)
}

// 转义空白字符为实体化字符（\n、\r、\t）
export function escapeWhiteSpace(s: string) {
    return s.replace(/[\n\r\t]/g, m => {
        switch (m) {
            case "\n":
                return "\\n"
            case "\r":
                return "\\r"
            default:
                return "\\t"
        }
    })
}

// 此方法会记录字符串的访问次数，并生成一个变量（值为字符串字面量），最后返回生成的变量标识符
export function stringify(v: any, padLeft = -1) {
    const s = normalStringify(v)
    if (inputDescriptor.options.check) {
        return s
    }

    const padIt = (v: string) => {
        return padLeft === -1 ? v : `__s${padLeft}.${v.slice(3)}`
    }
    if (stringConstants.has(s)) {
        const existingItem = stringConstants.get(s)!
        return existingItem.count++, padIt(existingItem.value)
    } else {
        const value = `__s${stringConstants.size}__`
        stringConstants.set(s, {
            value,
            count: 1,
            using: false,
            n: stringConstants.size
        })
        return stringConstantsSourceMap.set(value, s), padIt(value)
    }
}

// 驼峰命名转串型命名格式
export function camel2Kebab(str: string, allowFullLower = true) {
    if (!allowFullLower && !/[A-Z]/.test(str.slice(1))) {
        return str
    }
    return str.replace(/[A-Z]/g, (m, i) => {
        return (i === 0 ? "" : "-") + m.toLowerCase()
    })
}

// kebab命名转Camel
export function kebab2Camel(str: string, startWithUppercase = false) {
    const re = startWithUppercase ? kebabWholeRE : kebabWithoutFirstLetterRE
    return str.replace(re, s => {
        return s === "-" ? "" : s.toUpperCase()
    })
}

// 通过转换后的字符串字面量标识符名称获取原始字符串字面量表达
export function getResotedStringLiteral(identifier: string) {
    const padMatched = stringLiteralConstantRE.exec(identifier)
    if (padMatched?.[1]) {
        identifier = identifier.slice(0, 3) + identifier.slice(3 + padMatched[1].length)
    }
    return {
        value: stringConstantsSourceMap.get(identifier)!,
        pad: Number(padMatched?.[1]?.slice(0, -1) ?? -1) as number
    }
}

// 在表达式中找到关闭括号的位置， 使用此方法时，startIndex应为开始括号的下一个位置
export function findEndBracket(str: string, startIndex: number, char: StartBracket = "{") {
    const pairMap = { "{": "}", "[": "]", "(": ")" }

    while (true) {
        const [startBracketIndex] = findOutOfStringComment(str, char, startIndex)
        const [endBracketIndex] = findOutOfStringComment(str, pairMap[char], startIndex)
        if (endBracketIndex === -1) {
            return -1
        }
        if (startBracketIndex === -1 || endBracketIndex < startBracketIndex) {
            return endBracketIndex
        }
        startIndex = endBracketIndex + 1
    }
}

function findOutOfGen(outString: boolean, outComment: boolean) {
    function generated(str: string, pattern: string | RegExp): number
    function generated(str: string, pattern: string | RegExp, startIndex?: number): NumNum
    function generated(str: string, pattern: string | RegExp, startIndex?: number) {
        const pis = isString(pattern)
        const withoutStartIndex = isUndefined(startIndex)
        const re = new RegExp(pis ? `^${pattern}` : `^${pattern.source}`, pis ? "" : pattern.flags)

        // 根据是否传入了startIndex返回正确的重载返回值
        const cr = (index: number, len: number) => {
            if (withoutStartIndex) {
                return index
            } else {
                return [index, len] as NumNum
            }
        }

        // ls（last string）表示剩余未查询部分的字符串
        for (let i = 0, ls = str; i < str.length; ls = str.slice(++i)) {
            if (outString && /^['"`]/.test(str[i])) {
                const stopCharacter = str[i]
                while (!(ls = str.slice(++i)).startsWith(stopCharacter)) {
                    // 模板字符串中插值表达式需要查找
                    if (ls.startsWith("${")) {
                        const endBracketIndex = findEndBracket(ls, 2)
                        const interpolationFoundRet: NumNum = (generated as any)(
                            ls.slice(2, endBracketIndex === -1 ? ls.length : endBracketIndex),
                            pattern,
                            startIndex ? startIndex - i - 2 : undefined
                        )
                        if (interpolationFoundRet[0] === -1) {
                            i += endBracketIndex
                            continue
                        }
                        return [interpolationFoundRet[0] + i + 2, interpolationFoundRet[1]]
                    }
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
            if (outComment && ls.startsWith("//")) {
                const endIndex = ls.indexOf("\n")
                if (endIndex === -1) {
                    return cr(-1, 0)
                }
                i += endIndex
                continue
            }
            if (outComment && ls.startsWith("/*")) {
                const endIndex = ls.indexOf("*/")
                if (endIndex === -1) {
                    return cr(-1, 0)
                }
                i += endIndex + 1
                continue
            }

            const matched = re.exec(ls)
            if (matched && i >= (startIndex || -1)) {
                return cr(i, matched[0].length)
            }
        }
        return cr(-1, 0)
    }
    return generated
}
