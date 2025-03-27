import { inputDescriptor } from "../state"
import { isNumber, isUndefined } from "../../util/shared/assert"
import { getLocByIndex } from "../../util/compiler/locations"
import { markPositionFlag, recordInterExpression } from "../../util/compiler/sundry"
import { findEndBracket, findOutOfComment, normalStringify } from "../../util/compiler/strings"
import { EmptyInterpolationExpression, UnclosedInterpolationExpression } from "../message/error"

// 将模板中的插值表达式转换成javascript表达式，此外该方法还会返回源码中每个位置的偏移量
export function content2script(content: string, startSourceIndex: number) {
    const isDebug = inputDescriptor.options.debug
    const shouldGenerateSourcemap = inputDescriptor.options.sourcemap

    let index = 0
    let transformedStrLen = 1
    let transformedStr: string
    let contentSourceIndex = 0

    const positionMap: number[] = []
    const transformedArr: string[] = []
    const emptyStrSource = normalStringify("")

    const pushTransformedArr = (str: string, useStringify = true) => {
        const sourceIndex = startSourceIndex + contentSourceIndex

        // 将textContent部分中的插值表达式范围内的索引标记为处于脚本块
        const markCurrentStrInScriptInterpolationBlock = () => {
            for (let i = 0; i <= str.length; i++) {
                markPositionFlag(sourceIndex + i + 1, "inScript")
            }
        }

        // 检查模式下，将插值表达式部分记录到中间代码片段
        if (inputDescriptor.options.check) {
            if (!useStringify) {
                markCurrentStrInScriptInterpolationBlock()
                recordInterExpression(str, [sourceIndex + 1])
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
                positionMap[endIndex] = sourceIndex + str.length
                positionMap[transformedStrLen] = sourceIndex
                transformedStrLen += stringifiedLen + 2
            }
            transformedArr.push(stringified)
        } else {
            if (shouldGenerateSourcemap) {
                const delta = Number(isDebug)
                for (let i = -delta; i <= str.length + delta; i++) {
                    positionMap[transformedStrLen + i] = sourceIndex + i
                }
                transformedStrLen += str.length + 2
            }
            transformedArr.push(str)
            markCurrentStrInScriptInterpolationBlock()
        }

        contentSourceIndex += str.length + Number(!useStringify)
    }

    while (index < content.length) {
        const startBracketIndex = content.indexOf("{", index)
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
        const endBracketIndex = findEndBracket(content, startBracketIndex + 1)
        if (endBracketIndex === -1) {
            UnclosedInterpolationExpression(getLocByIndex(startBracketSourceIndex))
            pushTransformedArr(content.slice(startBracketIndex))
            break
        } else {
            const interpolationExp = content.slice(startBracketIndex + 1, endBracketIndex)
            if (((index = endBracketIndex + 1), findOutOfComment(interpolationExp, /\S/) === -1)) {
                EmptyInterpolationExpression(
                    startBracketSourceIndex,
                    endBracketIndex + 1 + startSourceIndex
                )
            } else {
                contentSourceIndex = startBracketIndex + 1
                pushTransformedArr(interpolationExp, false)
                if (!isDebug) {
                    continue
                }
            }
        }
    }

    // 检查模式下无需后续处理，直接返回
    if (inputDescriptor.options.check) {
        return { positionMap: [], script: "" }
    }

    // 调试模式下，将第一个存在的映射位置元素放在positionMap首位，以保持断点设置在textContent开始和结尾处的一致性
    if (isDebug && isNumber(positionMap[1]) && isUndefined(positionMap[0])) {
        positionMap[0] = positionMap[1]
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
    } else {
        transformedStr = `[${transformedArr.join(", ")}]`
    }

    return {
        positionMap,
        script: transformedStr
    }
}
