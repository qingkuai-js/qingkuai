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
 * current-warn-code: 9010
 *
 * 警告代码解释：以数字9开头的代码表示这是一个编译器警告
 * Warning Code Explanation: Code beginning with the number 9 indicates that this is a compiler warning
 */

import type { ASTLocation } from "../types"
import type { GeneralFunc, NumNum } from "../../util/types"

import { messages } from "../state"
import { commonMessage } from "./common"
import { isNumber } from "../../util/shared/assert"
import { lastElem } from "../../util/shared/sundry"
import { getLocByIndex } from "../../util/compiler/locations"

// prettier-ignore
export const MixTwoSyntaxOfDerived = withLocation(
    ...commonMessage.MixTwoSyntaxOfDerived
)

// prettier-ignore
export const IdentifierMaybeOverwritten = withLocation(
    ...commonMessage.IdentifierMaybeOverwritten
)

export const RedundantArgsForCompilerFunc = withLocation(
    ...commonMessage.RedundantArgsForCompilerFunc
)

export const AttributeForEndTag = withLocation(9001, () => {
    return "Attributes in the end tag will be ignored."
})

export const InvalidEventFlag = withLocation(9005, (flagName: string, eventName: string) => {
    return `Invalid flag(${flagName}) for event(@${eventName}) and it has been ignored.`
})

export const DuplicateEventModifiers = withLocation(
    9010,
    (modifiers: string[], eventName: string) => {
        return `There are some duplicate modifiers(${modifiers.join(", ")}) on ${eventName} event.`
    }
)

export const InvalidComposeModifier = withLocation(9007, (eventName: string) => {
    return `The event modifier(compose) is not valid for ${eventName} even, it can only be used for input event.`
})

export const InvalidEventFlagForComponent = withLocation(9006, (flagDescription: string) => {
    return `The event parameter for component can not accept any flag(${flagDescription}), and they has been ignored.`
})

export const ConflictNormalKeyEventModifier = withLocation(9009, (modifiers: string[]) => {
    const [joined, last] = [modifiers.join(", "), lastElem(modifiers)]
    return `The normal key event modifiers(${joined}) is conflict, and the last one(${last}) will be applied according to the priority.`
})

export const InvalidKeyRelatedModifier = withLocation(
    9008,
    (modifier: string, eventName: string) => {
        return `The event modifier(${modifier}) is not valid for ${eventName} even, it can only be used for these events: keyup, keydown, keypress.`
    }
)

// 检查参数是否是QingKuai编译器警告
export function isCompileWarning(v: any): v is CompileWarning {
    return v instanceof CompileWarning
}

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
            warnLoc = getLocByIndex(...(args.slice(-2) as NumNum))
        } else {
            warnLoc = lastElem(args) as ASTLocation
            warnMethodArgs = args.slice(0, -1) as any
        }
        new CompileWarning(warnLoc, code, fn(...warnMethodArgs))
    }
    return warn
}

export class CompileWarning {
    constructor(public loc: ASTLocation, public code: number, public message: string) {
        messages.push({
            value: this,
            type: "warning"
        })
    }
}
