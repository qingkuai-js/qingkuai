import type { FixedArray } from "../types"
import type { ASTLocation, ASTPosition, EliminateRanges } from "../../compiler/types"

import { isUndefined } from "../shared/assert"
import { kebabWholeRE, kebabWithoutFirstLetterRE } from "../../compiler/regular"

// JSON.stringify别名
export function normalStringify(v: any) {
    return JSON.stringify(v)
}

// 生成一个默认的ASTPosition结构
export function newASTPosition(): ASTPosition {
    return {
        line: 0,
        column: 0,
        index: 0
    }
}

// 生成一个默认的ASTLocation结构
export function newASTLocation(): ASTLocation {
    const pos = newASTPosition()
    return {
        start: pos,
        end: pos
    }
}

// 生成一个带有位置信息的值结构
export function newValueWithLoc<T>(value: T, loc?: ASTLocation) {
    if (isUndefined(loc)) {
        loc = newASTLocation()
    }
    return { value, loc }
}

// 确定标识符别名
export function confirmAlias(name: string, existing: Set<string>) {
    while (existing.has(name)) {
        name = "_" + name
    }
    return name
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
