import type { ReplacementItem } from "../types"

import {
    sourceMapInfo,
    debuggingInfo,
    replacementInfo,
    eliminateRanges,
    inputDescriptor
} from "../state"
import { MinHeap } from "../data-struct/min-heap"
import { compilerOptions } from "../configuration"
import { isString } from "../../util/shared/assert"
import { lastElem } from "../../util/shared/sundry"
import { getScriptPos } from "../../util/compiler/locations"
import { scriptSourceRedundantEmptyLine, scriptSourceNeedIndentPlace } from "../regular"
import { isIndexEliminated, getPositionOfEachChar, indent } from "../../util/compiler/sundry"

export function transformScript(source: string, indentN = 0) {
    const transformedArr: string[] = []
    const existingReplacementItem = new Set<ReplacementItem>()
    const shouldGenerateSourcemap = compilerOptions.generateSourcemap
    const heap = new MinHeap<ReplacementItem>([], "index", "order", "id")
    replacementInfo.map.forEach((repl, identifier) => {
        if (repl.status === "rea") {
            repl.items.forEach(item => {
                if (!existingReplacementItem.has(item)) {
                    heap.insert(item)
                    existingReplacementItem.add(item)
                }
            })

            // 调试模式下，如果repl.createSetter为true时，将响应性变量的初始标识符记录到debuggingInfo.setters中
            // 这些标识符将被用来在生成代码的底部创建setter，如果createSetter为false（对应const声明的响应性常量），
            // 则将标识符添加到debuggingInfo.constIdentifiers中，它们会在一个名为_dn_的setter中被访问，虽然它们
            // 不需要被赋值，但要保持被引用的状态，不然首次同步代码执行结束时，初始标识符占用的内存空间会被释放
            if (repl.useDollar && compilerOptions.debugeMode) {
                if (!repl.createSetter) {
                    debuggingInfo.constIdentifiers.add(identifier)
                } else {
                    debuggingInfo.setters.set(identifier, debuggingInfo.setters.size)
                }
            }
        }
    })

    // 这里会将sourcemap信息中的生成列偏移
    // lastColumn表示当前处理的索引(i)对应的生成列，currentLoc为索引i对应的生成代码中的位置信息
    // eachColumnOffset记录了当前生成行中每一列需要偏移的量，转换过程中遇到添加replacementItem
    // 会增加对应生成列的偏移量，如果当前索引被忽略(处于eliminateRanges中)时，会减少对应生成列的
    // 偏移量如果遇到了在标识符前添加_w_前缀且当前索引存在sourcemap信息的情况时，会将对应生成列的偏移量-3
    let mappingLine = 1
    let nextColumnOffset = 0
    let replacementItem = heap.fetch()
    let eachColumnOffset: number[] = []

    // 添加一条生成列偏移信息，不是首个元素时默认就是上一列的偏移信息，
    // 比如假设第1列需要向右偏移3，那么第2列就在在向右偏移3的基础上进行增加或减少，并依此类推，
    // 基础偏移量确定之后还要增加上上次记录的下一行应该添加的额外偏移量，额外偏移量和替换字符串是否为标识符前缀有关：
    // 当替换字符是_w_或[_w_标识符前缀时，当前列会记录偏移量-3（前缀固定长度），下一列的额外偏偏移量则为+6/+7
    const recordColumnOffset = () => {
        const preColumnOffset = lastElem(eachColumnOffset) || 0
        eachColumnOffset.push(preColumnOffset + nextColumnOffset)
        nextColumnOffset = 0
    }

    for (let i = 0; i < source.length; i++) {
        const isLastIndex = i === source.length - 1
        const { line: currentLine, column: currentColumn } = getScriptPos(i)

        // 开始新行前完成上一行的生成列偏移
        if (shouldGenerateSourcemap) {
            if (isLastIndex) {
                recordColumnOffset()
            }
            if (mappingLine !== currentLine || isLastIndex) {
                sourceMapInfo.mappings[mappingLine - 1]?.forEach(segment => {
                    segment[0] += eachColumnOffset[segment[3]!]
                })
                if (!isLastIndex) {
                    nextColumnOffset = 0
                    eachColumnOffset = []
                    mappingLine = currentLine
                }
            }
            recordColumnOffset()
        }

        // 当前索引存在replacementItem与之对应，增加生成列偏移信息（text的长度）
        // 如果是text为_w_或[_w_前缀时，将额外偏移量（nextColumnOffset）-3/-4
        while (replacementItem && replacementItem.index === i) {
            const { text } = replacementItem
            if (isString(text)) {
                if (shouldGenerateSourcemap && /^\[?_w_$/.test(text)) {
                    nextColumnOffset += 3
                    eachColumnOffset[currentColumn] -= 3
                }
                transformedArr.push(text)
                eachColumnOffset[currentColumn] += text.length
            } else {
                const textStr = text()
                transformedArr.push(textStr)
                eachColumnOffset[currentColumn] += textStr.length
            }
            replacementItem.processed = true
            while (replacementItem?.processed) {
                replacementItem = heap.fetch()
            }
        }

        // 索引对应的字符处于消除列表，减少生成列偏移信息
        if (isIndexEliminated(i, eliminateRanges)) {
            nextColumnOffset--
            continue
        }
        transformedArr.push(source[i])
    }

    // 确定script部分缩进采用的空格数量
    const joinedTransformedArr = transformedArr.join("")
    const indentSpaceCount = inputDescriptor.indentSpaceCount
    const joinedTransformedPositions = getPositionOfEachChar(joinedTransformedArr)

    // 移除多余的空行，将被移除的行号记录在sourcemap.removedLine中，在最终的sourcemap偏移时移除这些行的映射信息
    const transformedStr = joinedTransformedArr.replace(scriptSourceRedundantEmptyLine, (s, i) => {
        if (shouldGenerateSourcemap) {
            let emptyLineCount = s.match(/\n/g)?.length || 0
            const startLine = joinedTransformedPositions[i].line - 1
            for (let j = +(i !== 0); emptyLineCount > 0; emptyLineCount--, j++) {
                sourceMapInfo.removedLine.add(startLine + j)
            }
        }
        return ""
    })

    if (!indentSpaceCount || !transformedStr) {
        return transformedStr
    }

    return transformedStr.replace(scriptSourceNeedIndentPlace, () => {
        return `${indent(indentN)}`
    })
}
