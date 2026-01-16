import type { GeneralFunc } from "#type-declarations/tools"

import { afterAll, beforeAll } from "vitest"
import { getLastElem } from "../shared/arrays"
import { currentDestruction } from "../../runtime/state"
import { createDestruction, destroy } from "../../runtime/destroy"

export function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms))
}

export function initDestruction() {
    afterAll(() => {
        destroy(currentDestruction!)
    })
    beforeAll(() => {
        if (!currentDestruction) {
            createDestruction()
        }
    })
}

export function getCurrentEffect() {
    return getLastElem(currentDestruction!.e!)!
}

// 通过传入触发指定错误的方法，捕获后返回错误信息
// Capture and return the error message by passing a function that triggers the specified error
export function getErrorMessage(makeErr: GeneralFunc) {
    try {
        makeErr()
    } catch (err: any) {
        return err.message
    }
}

// 问题：由于使用模板字符串(反引号)书写源码时会保留所有空格。然而在书写带有缩进的
// 代码字符串时为了保证可读性，模板字符串内的缩进受到其所在文件位置处缩进等级的影响；
// 而若要保证正确性则要严格控制模板字符串中的缩进等级，但这样通常会牺牲一定的可读性
//
// 此方法接受代码文本，并移除首行所有前导空格字符，剩余行会移除与首行等量的前导空格字符
// 注意：此方法识别代码使用缩进量量的方法为首行空格字符数量且开始和结尾处的空白行会被移除

// Issue: When writing source code with template strings (backticks), all spaces are preserved.
// However, when writing indented code strings for readability, the indentation inside the template string
// is affected by the indentation level of its location in the file.
// To ensure correctness, one must strictly control the indentation inside the template string,
// but this often comes at the cost of readability.
//
// This method accepts a code string and removes all leading spaces from the first line,
// for the remaining lines, it removes the same number of leading spaces as the first line had.
// Note: This method determines the indentation level based on the number of leading spaces in the first line,
// and any blank lines at the beginning and end will be removed.
export function formatSourceCode(code: string) {
    code = code.trimEnd()
    code = code.replace(/\n?[\s]*\n/, "")

    const uselessIndentStr = /^[ \t]*/.exec(code)![0]
    return code.replace(new RegExp(`(?<=^|\\n)${uselessIndentStr}`, "g"), "")
}
