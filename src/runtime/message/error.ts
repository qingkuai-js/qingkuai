/**
 * 为了整个文件可读性，应尽量将较少代码的错误方法放在靠前的位置，但这样会导致错误代码
 * 不能与方法的顺序保持一致，所以这里在文件头记录了最后一个使用的错误代码（在下方的
 * last-error-code处）每次添加错误方法并使用新的错误代码时，需要将本次使用的错误
 * 代码更新到文件的头部注释中（约定：新错误代码为 last-error-code + 1）
 *
 * For the sake of the overall readability of this file, we should try
 * put the error method with less code in the front, however this results
 * in error codes can not conform to the order of the methods.
 * So, the last error code used is recorded in the file header comment
 * (at last-error-code below), each time you add a new error method and use a
 * new error code, you need update the error code you used this time to the header
 * comment of this file. (Convention: the new error code is: last-error-code + 1)
 *
 * last-error-code: 2007
 *
 * 错误代码解释：以数字2开头的代码表示这是一个运行时致命错误
 * Error Code Explanation: code begining with the number 2 indicates that this is a runtime fatal error
 */

import type { GeneralFunc } from "../../util/types"

import { commonMessage } from "./common"
import { BAD_TARGET_MOUNT_KIND } from "../constants"

export const InstantiateComponentManually = withCode(...commonMessage.InstantiateComponentManually)

export const NonTraverse = withCode(2001, () => {
    return "The given value for for-directive is non-traversable."
})

export const NotPromise = withCode(2002, () => {
    return "The given value for await-directive is not a Promise."
})

export const DuplicateKey = withCode(2003, (key: string) => {
    return "Duplicate key for keyed-for-module, duplicate key: " + key
})

export const ContainerTypeIsBad = withCode(2004, (attrName: string, tag: string) => {
    return `The container for reference attribute(&${attrName}) of <${tag}> tag must be an Array or Set.`
})

export const BadTarget = withCode(2007, (selector: string, kind: number) => {
    const kindStr = kind === BAD_TARGET_MOUNT_KIND ? "app mounting" : "#target directive"
    return `The given document selector(${selector}) can not find corresponding node for ${kindStr}.`
})

export const BadReactivityLevel = withCode(2006, (level: number) => {
    return `Bad reactivity level(${level}), if you don't want the target to be reactive, mark it with stc compiler helper function instead of rea.`
})

function withCode<T extends GeneralFunc<string>>(code: number, msgGetter: T) {
    return (...args: Parameters<T>): never => {
        throw new TypeError(`${msgGetter(...args)} (${code})`)
    }
}
