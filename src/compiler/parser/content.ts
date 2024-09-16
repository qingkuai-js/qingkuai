import { inputDescriptor } from "../state"
import { compilerOptions } from "../configuration"
import { EmptyInterpolationExpression, UnclosedInterpolationExpression } from "../message/error"
import { findOutOfSC, normalStringify } from "../../util/compiler/sundry"

// 将模板中的插值表达式转换成javascript表达式，此外该方法还会返回源码中每个位置的偏移量
export function content2script(content: string, startSourceIndex: number) {
    let rc = 0
    let index = 0
    let last = content
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
            if (!str.length) {
                EmptyInterpolationExpression()
            }
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

    while (last) {
        if ((index = last.indexOf("{")) === -1) {
            pushTransformedArr(last, true)
            break
        }

        // 将表达式开始前的字符串认作普通字符串字面量
        if (index !== 0) {
            pushTransformedArr(last.slice(0, index))
        }

        // 收缩未处理范围，开始表达式处理，rc表示表达式被花括号包裹的层级，默认为1
        last = last.slice(index + 1)
        index = 0
        rc++

        // 包裹层级为0且找到闭合花括号时，这段范围被认为是script代码
        while (true) {
            const bracketIndex = findOutOfSC(last.slice(index), /[{}]/)
            if (bracketIndex === -1) {
                UnclosedInterpolationExpression()
            }
            index += bracketIndex
            rc = last[index] === "{" ? rc + 1 : rc - 1
            if (rc === 0) {
                pushTransformedArr(last.slice(0, index), false)
                last = last.slice(index + 1)
                break
            }
            index++
        }
    }

    return {
        positionMap,
        script: transformedArr.join(" + ") || normalStringify("")
    }
}
