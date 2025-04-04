import type {
    ASTLocation,
    TemplateNode,
    EliminateRanges,
    TemplateAttribute,
    ASTPositionWithFlag
} from "../../compiler/types"
import type { FixedArray, NumNum, PositionFlagKeys } from "../types"

import {
    SELF_CLOSING_TAGS,
    IntercodeSnippetKind,
    MUST_PASS_VALUE_DIRECTIVES
} from "../../compiler/constants"
import { randomBytes } from "node:crypto"
import { PositionFlag } from "../shared/flag"
import { templateEmbeddedLangTagRE } from "../../compiler/regular"
import { isEmptyString, isString, isUndefined } from "../shared/assert"
import {
    debuggingInfo,
    inputDescriptor,
    interCodeSnippets,
    templateNodeToContextIdentifiers
} from "../../compiler/state"

export function isSelfClosingTag(tag: string) {
    return SELF_CLOSING_TAGS.has(tag)
}

export function isEmbededLanguageTag(tag: string) {
    return templateEmbeddedLangTagRE.test(tag)
}

export function mustDirectiveHasValue(name: string) {
    return MUST_PASS_VALUE_DIRECTIVES.has(name)
}

// 通过ASTLocation获取[number,number]类型的索引范围表示
export function getRangeByLoc(loc: ASTLocation): NumNum {
    return [loc.start.index, loc.end.index]
}

// 获取调试setter标识符
export function getSetterIdentifier(identifier: string) {
    return `__d${debuggingInfo.setters.get(identifier)}__`
}

// 生成指定数量的缩进字符
export function indent(n = 1) {
    return " ".repeat(inputDescriptor.indentSpaceCount * n)
}

// 生成指定长度的随机哈希字符串
export const createHashId = (function () {
    const existing = new Set<string>()
    return () => {
        while (true) {
            const hash = randomBytes(4).toString("hex")
            if (existing.has(hash)) {
                continue
            }
            return existing.add(hash), hash
        }
    }
})()

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

// 从templateNode的attribute列表中查找符合指定模式的属性
export function findSpecificAttr<T extends TemplateAttribute>(
    attrs: T[],
    pattern: RegExp | string
): T | undefined {
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

// 获取节点可用的上下文标识符
export function getContextIdentifiers(node: TemplateNode) {
    const result = new Set<string>()
    while (node) {
        templateNodeToContextIdentifiers.get(node)?.forEach(identifier => {
            result.add(identifier)
        })
        node = node.parent as any
    }
    return Array.from(result)
}

// 为inputDescript.positions中某个索引的位置添加指定的flag标记
export function markPositionFlag(index: number, flagName: PositionFlagKeys) {
    inputDescriptor.positions[index].flag |= PositionFlag[flagName]
}

// 记录表达式中间代码片段，它们在中间代码中会被赋值给__c__.Receiver
// 为什么要这样处理：插值块中只能接受表达式，这一点与赋值表达式等号右侧的规则是一致的
export function recordInterExpression(exp: string, range: [number, number?]) {
    if (isEmptyString(exp)) {
        return
    }

    interCodeSnippets.push([IntercodeSnippetKind.VoidSource, "__c__.Receiver="])

    // range[1]存在时需要调用recordInterWithSpecificRange方法记录中间代码片段
    if (isUndefined(range[1])) {
        interCodeSnippets.push([range[0], exp])
    } else {
        recordInterSnippetWithSpecificRange(exp, ...(range as NumNum))
    }

    interCodeSnippets.push([IntercodeSnippetKind.SearchForward, ";"])
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

// 根据指定原始范围记录一个中间代码片段，有时生成的中间代码片段会与源码片段长度不一致，此时只需将源码除最后一个
// 字符外的部分正常记录，最后一个字符记录到结束位置即可，此方法需要再片段末尾补一个空格以保证结尾处的位置映射正确
export function recordInterSnippetWithSpecificRange(snippet: string, start: number, end: number) {
    switch (snippet.length) {
        case 0:
            return
        case 1:
            interCodeSnippets.push([start, snippet])
            break
        default:
            interCodeSnippets.push([start, snippet.slice(0, -1)], [end, snippet.slice(-1)])
    }
}
