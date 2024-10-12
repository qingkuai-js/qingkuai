/**
 * 为了整个文件可读性，应尽量将较少代码的警告方法放在靠前的位置，但这样会导致警告代码
 * 不能与方法的顺序保持一致，所以这里在文件头记录了最后一个使用的警告代码（在下方的
 * last-error-code处）每次添加警告方法并使用新的警告代码时，需要将本次使用的警告
 * 代码更新到文件的头部注释中（约定：新警告代码为 last-error-code + 1）
 *
 * For the sake of the overall readability of this file, we should try
 * put the warn method with less code in the front, however this results
 * in warn codes can not conform to the order of the methods.
 * So, the last warn code used is recorded in the file header comment
 * (at last-warn code below), each time you add a new warn method and use a
 * new warn code, you need update the warn code you used this time to the header
 * comment of this file. (Convention: the new warn code is: last-warn-code + 1)
 *
 * current-warn-code: 9001
 *
 * 警告代码解释：以数字9开头的代码表示这是一个编译器警告
 * Warning Code Explanation: Code beginning with the number 9 indicates that this is a compiler warning
 */

import type { ASTLocation } from "../types"
import type { FixedArray, GeneralFunc } from "../../util/types"

import { isNumber } from "../../util/shared/assert"
import { lastElem } from "../../util/shared/sundry"
import { getLocByIndex } from "../../util/compiler/locations"
import { messages } from "../state"

export const AttributeForEndTag = withLocation(9001, () => {
    return "The end tag will ignore any attribute."
})

export const RedundantArgs = withLocation(9002, (fn: string, need: number | string) => {
    let needMsg = "requires only one parameter"
    if (!isNumber(need) || need > 1) {
        needMsg = `accepts a maximum of ${need} parameters`
    }
    return `${fn} ${needMsg}, and the excess parameters has been ignored.`
})

export const IdentifierMaybeOverwritten = withLocation(9003, (name: string) => {
    return `The top scope identifier(${name}) may be overwrittern in inline event.`
})

export const DerLoseReactivity = withLocation(9004, () => {
    return "Destructure the return value of der will result in a loss of reacativity."
})

export const MixTwoSyntaxOfDerived = withLocation(9005, () => {
    return "Mixing the two syntax to declare derived reactive state is not recommended."
})

export const InvalidEventFlag = withLocation(9006, (flagName: string, eventName: string) => {
    return `Invalid flag(${flagName}) for event(@${eventName}) and it has been ignored.`
})

export const InvalidEventForSlot = withLocation(9007, (eventName: string) => {
    return `Event listener(${eventName}) is invalid for slot tag, and it has been ignored.`
})

export const InvalidEventFlagForComponent = withLocation(9008, (flagDescription: string) => {
    return `The event parameter for component can not accept any flag(${flagDescription}), and they has been ignored.`
})

// 为返回警告描述信息的方法添加位置参数，它返回的是一个重载函数，这个重载函数会将原函数返回的警告信息发出，
// 并为原方法添加接受一个ASTLocation或两个number（开始位置和结束位置）参数用来描述错误位置
function withLocation<T extends GeneralFunc>(code: number, fn: T) {
    function warn(...args: [...Parameters<T>, loc: ASTLocation]): void
    function warn(...args: [...Parameters<T>, startIndex: number, endIndex: number]): void
    function warn(
        ...args: [...Parameters<T>, locOrStartIndex: ASTLocation | number, endIndex?: number]
    ) {
        let warnLoc: ASTLocation
        let warnMethodArgs: [...Parameters<T>]
        if (isNumber(lastElem(args))) {
            warnMethodArgs = args.slice(0, -2) as any
            warnLoc = getLocByIndex(...(args.slice(-2) as FixedArray<number, 2>))
        } else {
            warnLoc = lastElem(args) as ASTLocation
            warnMethodArgs = args.slice(0, -1) as any
        }
        new CompileWarning(warnLoc, code, fn(...warnMethodArgs))
    }
    return warn
}

export class CompileWarning {
    constructor(public loc: ASTLocation, public code: number, public msg: string) {
        messages.push({
            value: this,
            type: "warning"
        })
    }
}
