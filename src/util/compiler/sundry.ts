import type { FindOutOfSC, FixedArray } from "../types"
import type { ASTLocation, ASTPosition, EliminateRanges } from "../../compiler/types"

import {
    kebabWholeRE,
    validIdentifierNameRE,
    kebabWithoutFirstLetterRE
} from "../../compiler/regular"
import { isString, isUndefined } from "../shared"
import { InvalidIdentifierName } from "../../compiler/message/error"

// JSON.stringify别名
export function normalStringify(v: any) {
    return JSON.stringify(v)
}

// 生成一个新的ASTPosition结构
export function newASTPosition(): ASTPosition {
    return {
        line: 0,
        column: 0,
        index: 0
    }
}

// 生成一个新的ASTLocation结构
export function newASTLocation(): ASTLocation {
    return {
        start: newASTPosition(),
        end: newASTPosition()
    }
}

// kebab命名转Camel
export function kebab2Camel(str: string, startWithUppercase = false) {
    const re = startWithUppercase ? kebabWholeRE : kebabWithoutFirstLetterRE
    return str.replace(re, s => {
        return s === "-" ? "" : s.toUpperCase()
    })
}

// 从source字符串中获取指定范围的字符串，返回值将去除被er包裹的部分
// er是有序的、无交集的范围列表，无需考虑顺序和范围合并问题
export function getPieceOfStrOutOfER(
    source: string,
    start: number,
    end: number,
    er: EliminateRanges
) {
    const ret: string[] = []
    for (const [s, e] of er) {
        if (start > e) {
            break
        }
        if (start < s) {
            ret.push(source.slice(start, s))
        }
        start = e
    }
    ret.push(source.slice(start, end))
    return ret.join("")
}

// 获取每一个字符的位置信息（行列及索引）
export function getPositionOfEachChar(str: string) {
    let line = 1
    let column = 0
    let char = str[0]
    const ret: ASTPosition[] = []
    for (let i = 0; i <= str.length; char = str[++i]) {
        ret.push({ line, column, index: i })
        if (char !== "\n") {
            column++
        } else {
            line++
            column = 0
        }
    }
    return ret
}

// 检查标识符名称是否合法
export function checkIdentifierName(...names: string[]) {
    for (const name of names) {
        if (!validIdentifierNameRE.test(name)) {
            InvalidIdentifierName(name)
        }
    }
}

// 判断某个索引是否被er包围，er的情况同getPieceOfStrOutOfER相同
export function isIndexEliminated(index: number, ranges: EliminateRanges) {
    for (const range of ranges) {
        const [rangeStart, rangeEnd] = range
        if (index >= rangeEnd) {
            ranges.delete(range)
            continue
        }
        if (index >= rangeStart && index < rangeEnd) {
            return true
        }
    }
    return false
}

// 将数组按size划分为二维数组
export function arrayChunk<T, S extends number>(arr: T[], size: S): FixedArray<T, S>[] {
    const arrLen = arr.length
    const retLen = Math.ceil(arrLen / size)
    const ret = Array(retLen).fill(null)
    for (let i = 0, j = 0; i < arrLen; i += size) {
        ret[j++] = arr.slice(i, i + size)
    }
    return ret
}

// 从js代码中脱离字符串和注释范围查找指定子串
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
    for (let i = startIndex!, ls = str; i < str.length; i++, ls = str.slice(i)) {
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
            const re = new RegExp("^" + pattern.source)
            const matched = re.exec(ls)
            if (matched) {
                return cr(i, matched[0].length)
            }
        }
    }

    return cr(-1, 0)
}
