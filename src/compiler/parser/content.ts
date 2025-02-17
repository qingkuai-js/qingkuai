import { inputDescriptor } from "../state"
import { isNumber } from "../../util/shared/assert"
import { getLocByIndex } from "../../util/compiler/locations"
import { newTemplateContext } from "../../util/compiler/structure"
import { transformInterpolation } from "../transformer/interpolation"
import { findEndCurlyBracket, normalStringify } from "../../util/compiler/strings"
import { markPositionFlag, recordInterExpression } from "../../util/compiler/sundry"
import { EmptyInterpolationExpression, UnclosedInterpolationExpression } from "../message/error"

// 将模板中的插值表达式转换成javascript表达式，此外该方法还会返回源码中每个位置的偏移量
export function content2script(content: string, startSourceIndex: number) {
    const isDebug = inputDescriptor.options.debug
    const transformedStrInitLen = isDebug ? 5 : 1
    const shouldGenerateSourcemap = inputDescriptor.options.sourcemap

    let index = 0
    let transformedStr: string
    let contentSourceIndex = 0
    let transformedStrLen = transformedStrInitLen

    const positionMap: number[] = []
    const transformedArr: string[] = []
    const context = newTemplateContext()
    const { positions } = inputDescriptor
    const emptyStrSource = normalStringify("")

    const pushTransformedArr = (str: string, useStringify = true) => {
        const sourceIndex = startSourceIndex + contentSourceIndex

        // 检查模式下，将插值表达式部分记录到中间代码片段，由于检查模式下后续步骤不会
        // 调用transformInterpolation方法，所以这里需要主动调用对插值块进行语法检查
        if (inputDescriptor.options.check) {
            if (
                !useStringify &&
                transformInterpolation(str, startSourceIndex, context, "content")
            ) {
                recordInterExpression(sourceIndex + 1, str)
            }
            return (contentSourceIndex += str.length + (useStringify ? 0 : 2)), void 0
        }

        // useStringify为true时表示当前处于普通字符串范围，此时只需记录字符串开头和结尾处
        // 对应的源码索引，否则则代表当前处于插值表达式范围，需要逐一记录每个字符对应的源码索引
        if (useStringify) {
            const stringified = normalStringify(str)
            if (shouldGenerateSourcemap) {
                const stringifiedLen = stringified.length
                const endIndex = transformedStrLen + stringifiedLen
                positionMap[transformedStrLen] = positions[sourceIndex].index
                positionMap[endIndex] = positions[sourceIndex + str.length].index
                transformedStrLen = +isDebug + endIndex + 2
            }
            transformedArr.push(stringified)
        } else {
            if (shouldGenerateSourcemap) {
                for (let i = 0; i <= str.length; i++) {
                    const delta = Number(isDebug && positionMap.length !== 0)
                    positionMap[delta + transformedStrLen + i] = sourceIndex + i + 1
                }
                transformedStrLen += str.length + (isDebug ? 5 : 2)
                contentSourceIndex += 2
            }

            // 将textContent部分中的插值表达式范围内的索引标记为处于脚本块
            for (let i = 0; i <= str.length; i++) {
                markPositionFlag(sourceIndex + i + 1, "inScript")
            }

            transformedArr.push(isDebug ? `(${str})` : str)
        }

        contentSourceIndex += str.length
    }

    while (index < content.length) {
        const startBracketIndex = content.indexOf("{", index)
        const startBracketNextIndex = startBracketIndex + 1
        const startBracketSourceIndex = startBracketIndex + startSourceIndex
        if (startBracketIndex === -1) {
            pushTransformedArr(content.slice(index))
            break
        }

        // 将表达式开始前的字符串认作普通字符串字面量
        if (startBracketIndex !== index) {
            pushTransformedArr(content.slice(index, (index = startBracketIndex)))
        }

        // 查找关闭花括号的位置，不存在就报错，存在则检查是否是空的插值表达式块，若为空同样需要报错
        const endBracketIndex = findEndCurlyBracket(content, startBracketNextIndex)
        if (endBracketIndex === -1) {
            UnclosedInterpolationExpression(getLocByIndex(startBracketSourceIndex))
            pushTransformedArr(content.slice(startBracketIndex))
            break
        } else {
            const interpolationExp = content.slice(startBracketNextIndex, endBracketIndex)
            if (((index = endBracketIndex + 1), !interpolationExp.trim())) {
                EmptyInterpolationExpression(
                    startBracketSourceIndex,
                    endBracketIndex + 1 + startSourceIndex
                )
            } else {
                pushTransformedArr(interpolationExp, false)

                if (!isDebug) {
                    continue
                }

                // 这里定义isStart和isEnd分别用来判断插值表达式是否在textContent的结尾和开头处，
                // 若它在结尾处，需要将positionMap的最后一个元素 + 1（最后一个插值表达式的结束位置）
                // 若它在开头处，需要将positionMap下标为1的元素 - 1（第一个插值表达式的起始位置，下标为0处是开始大括号）
                //
                // 此处理是为了在调试代码时，将断点设置位放置在以插值表达式开始的开始大括号前和以插值表达式结尾的结束大括号后
                // 这样做是为了保持与其他情况断点位置的一致性（均为textContent部分开头首个非空白字符和最后一个非空白字符处）
                const isEnd = endBracketIndex === content.length - 1
                const isStart = transformedStrLen === transformedStrInitLen
                if (isEnd) {
                    positionMap[transformedStrLen - 4]++
                }
                if (isStart) {
                    positionMap[transformedStrInitLen + 1]--
                }
            }
        }
    }

    // 检查模式下无需后续处理，直接返回
    if (inputDescriptor.options.check) {
        return { positionMap: [], script: "" }
    }

    // 调试模式下，将第一个存在的映射位置元素放在positionMap首位，保持首个断点设置位在content开始位置的一致性
    if (isDebug && isNumber(positionMap[5])) {
        positionMap[0] = positionMap[5]
        delete positionMap[5]
    }

    // 调试模式和飞调试模式的转换结果不同，对于相同的输入字符串：a {b} c，它们的转换结果格式如下：
    // 调试模式转换结果： "" + "a" + (b) + "c"      非调试模式转换结果：["a", b, "c"]
    //
    // 这样做是因为在调试模式下对编译体积不是很敏感，编译成字符串相加的表达式可以在调试时更直观地看到
    // textContent部分的运算返回值，而非调试模式对编译体积比较敏感，编译成数组可以有效压缩编译体积
    // 因为字符串相加表达式中必须将插值表达式使用括号括起来，否则运算顺序可能不正确，而有些括号是无
    // 意义的，相较于实现对无意义括号的检测使用数组更方便一些，且这两种方式在压缩后占用的字节数一致
    if (!transformedArr.length) {
        transformedStr = emptyStrSource
    } else if (!isDebug) {
        transformedStr = `[${transformedArr.join(", ")}]`
    } else {
        transformedStr = `${emptyStrSource} + ${transformedArr.join(" + ")}`
    }

    return {
        positionMap,
        script: transformedStr
    }
}
