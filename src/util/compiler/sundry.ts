import type {
    ASTLocation,
    EliminateRanges,
    TemplateAttribute,
    ASTPositionWithFlag
} from "../../compiler/types"
import type { FixedArray, PositionFlagKeys } from "../types"

import { PositionFlag } from "../shared/flag"
import { isEmptyString, isString } from "../shared/assert"
import { validIdentifierNameRE, bannedIdentifierFormatRE } from "../../compiler/regular"
import { debuggingInfo, inputDescriptor, interCodeSnippets } from "../../compiler/state"
import { IdentifierFormatIsNotAllowed, InvalidIdentifierName } from "../../compiler/message/error"

// 获取调试setter标识符
export function getSetterIdentifier(identifier: string) {
    return `__d${debuggingInfo.setters.get(identifier)}__`
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
    const ret: ASTPositionWithFlag[] = []
    for (let i = 0; i <= str.length; char = str[++i]) {
        ret.push({ line, column, index: i, flag: 0 })
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

// 为inputDescript.positions中某个索引的位置添加指定的flag标记
export function markPositionFlag(index: number, flagName: PositionFlagKeys) {
    inputDescriptor.positions[index].flag |= PositionFlag[flagName]
}

// 从templateNode的attribute列表中查找符合指定模式的属性
export function findSpecificAttr(attrs: TemplateAttribute[], pattern: RegExp | string) {
    const patternIsString = isString(pattern)
    for (const attr of attrs) {
        if (
            (patternIsString && attr.key.raw === pattern) ||
            (!patternIsString && pattern.test(attr.key.raw))
        ) {
            return attr
        }
    }
    return undefined
}

// 记录表达式中间代码片段，它们在中间代码中会被赋值给__c__.Receiver
// 为什么要这样处理：插值块中只能接受表达式，这一点与赋值表达式等号右侧的规则是一致的
export function recordInterExpression(startSourceIndex: number, exp: string) {
    if (!isEmptyString(exp)) {
        interCodeSnippets.push([-1, "__c__.Receiver="], [startSourceIndex, exp], [-2, ";"])
    }
}

// 根据指定原始范围记录一个中间代码片段，有时生成的中间代码片段会与源码片段长度不一致，此时只需将源码除最后一个
// 字符外的部分正常记录，最后一个字符记录到结束位置即可，如果原始片段长度仅为1，可以在中间代码片段最后补一个空格
export function recordInterWithSpecificRange(snippet: string, start: number, end: number) {
    snippet.length === 1 && (snippet += " ")
    interCodeSnippets.push([start, snippet.slice(0, -1)], [end, snippet.slice(-1)])
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
