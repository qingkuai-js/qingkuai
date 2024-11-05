import type { FixedArray } from "../types"
import type { ASTLocation, ASTPosition, EliminateRanges } from "../../compiler/types"

import {
    kebabWholeRE,
    validIdentifierNameRE,
    bannedIdentifierFormatRE,
    kebabWithoutFirstLetterRE
} from "../../compiler/regular"
import { debuggingInfo, inputDescriptor, interCodeSnippets } from "../../compiler/state"
import { IdentifierFormatIsNotAllowed, InvalidIdentifierName } from "../../compiler/message/error"
import { isEmptyString } from "../shared/assert"

// 获取调试setter标识符
export function getSetterIdentifier(identifier: string) {
    return `_d${debuggingInfo.setters.get(identifier)}_`
}

// 生成指定数量的缩进字符
export function indent(n = 1) {
    return " ".repeat(inputDescriptor.indentSpaceCount * n)
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

// 记录表达式中间代码片段，它们在中间代码中会被放在一个数组中
// 为什么要这样处理：插值块中只能接受表达式，这一点与数组元素是一致的
export function recordInterExpression(startSourceIndex: number, exp: string) {
    if (!isEmptyString(exp)) {
        interCodeSnippets.push([-1, "["], [startSourceIndex, exp], [-2, "];"])
    }
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

// 检查标识符名称是否合法, checkInvalid用来控制是否需要检测标识符名称是否合法，如果
// 是从AST的Identifier捕获组中调用此方法的话，可以将其设置为false，省去一部分检测开销
export function checkIdentifierName(name: string, errLoc: ASTLocation, checkInvalid = true) {
    if (checkInvalid && !validIdentifierNameRE.test(name)) {
        InvalidIdentifierName(name, errLoc)
    }
    if (bannedIdentifierFormatRE.test(name)) {
        IdentifierFormatIsNotAllowed(name, errLoc)
    }
}
