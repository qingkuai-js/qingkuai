import { inputDescriptor } from "../state"
import { compilerOptions } from "../configuration"
import { findEndCurlyBracket, findOutOfSC } from "../../util/compiler/strings"
import { normalStringify } from "../../util/compiler/sundry"
import { EmptyInterpolationExpression, UnclosedInterpolationExpression } from "../message/error"
import { getLocByIndex } from "../../util/compiler/state"

// 将模板中的插值表达式转换成javascript表达式，此外该方法还会返回源码中每个位置的偏移量
export function content2script(content: string, startSourceIndex: number) {
    let index = 0
    let transformedStrLen = 0
    let contentSourceIndex = 0

    const positionMap: number[] = []
    const transformedArr: string[] = []
    const { positions } = inputDescriptor

    const pushTransformedArr = (str: string, useStringify = true) => {
        const sourceIndex = startSourceIndex + contentSourceIndex
        // useStringify为true时表示当前处于普通字符串范围，此时只需记录字符串开头和结尾处对应的源码索引，
        // 否则则代表当前处于插值表达式范围，需要逐一记录每个字符对应的源码索引（左右两个圆括号无映射）
        if (useStringify) {
            const stringified = normalStringify(str)
            if (compilerOptions.generateSourcemap) {
                const stringifiedLen = stringified.length
                const endIndex = transformedStrLen + stringifiedLen
                positionMap[transformedStrLen] = positions[sourceIndex].index
                positionMap[endIndex] = positions[sourceIndex + str.length].index
                transformedStrLen = endIndex + 3
            }
            transformedArr.push(stringified)
        } else {
            if (compilerOptions.generateSourcemap) {
                for (let i = 0; i <= str.length; i++) {
                    const charSourceIndex = positions[sourceIndex + i + 1].index
                    positionMap[transformedStrLen + i + 1] = charSourceIndex
                }
                transformedStrLen += str.length + 5
                contentSourceIndex += 2
            }
            transformedArr.push(`(${str})`)
        }
        contentSourceIndex += str.length
    }

    while (index < content.length) {
        const startBracketIndex = content.indexOf("{", index)
        const startBracketNextIndex = startBracketIndex + 1
        const startBracketSourceIndex = startBracketIndex + startSourceIndex
        if (startBracketIndex === -1) {
            pushTransformedArr(content)
            break
        }

        // 将表达式开始前的字符串认作普通字符串字面量
        if (startBracketIndex !== index) {
            pushTransformedArr(content.slice(0, (index = startBracketIndex)))
        }

        // 查找关闭花括号的位置，不存在就报错，存在则检查是否是空的插值表达式块，若为空同样需要报错
        const endBracketIndex = findEndCurlyBracket(content, startBracketNextIndex)
        if (endBracketIndex === -1) {
            UnclosedInterpolationExpression(getLocByIndex(startBracketSourceIndex))
        } else {
            const interpolationExp = content.slice(startBracketNextIndex, endBracketIndex)
            if (!interpolationExp.trim()) {
                EmptyInterpolationExpression(
                    getLocByIndex(startBracketSourceIndex, endBracketIndex + 1 + startSourceIndex)
                )
            } else {
                index = endBracketIndex + 1
                pushTransformedArr(interpolationExp, false)
            }
        }
    }

    return {
        positionMap,
        script: transformedArr.join(" + ") || normalStringify("")
    }
}
