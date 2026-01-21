import type { ParserOptions } from "@babel/parser"

import { inputDescriptor } from "../state"
import { isUndefined } from "../../util/shared/assert"
import { objectAssign } from "../../util/shared/aliases"
import { getPosByIndex } from "../../util/compiler/position"
import { parse, parseExpression as _parseExpression } from "@babel/parser"

export function parseScript(source: string) {
    try {
        return parse(
            source,
            getParserOptions({
                sourceType: "module"
            })
        ).program
    } catch (error: any) {
        correctErrorInfomations(error, inputDescriptor.script.loc.start.index)
    }
}

export function parseExpression(source: string, startsourceIndex = 0, postfix = "") {
    try {
        return _parseExpression(source + postfix, getParserOptions())
    } catch (error: any) {
        correctErrorInfomations(error, startsourceIndex)
    }
}

// 将解析错误的位置信息修改为源码位置信息
// Change the location information of parse error to the source location
function correctErrorInfomations(error: any, sourceIndex: number) {
    if (!inputDescriptor.options.checkMode) {
        const sourcePosition = getPosByIndex(sourceIndex)
        if (!isUndefined(error.loc)) {
            objectAssign(error.loc, sourcePosition)
        }
        error.pos = sourceIndex
        error.message = error.message.replace(
            /\(\d+:\d+\)$/,
            `(${sourcePosition.line}:${sourcePosition.column})`
        )
        throw error
    }
}

function getParserOptions(initial: ParserOptions = {}) {
    const ret: ParserOptions = {
        ...initial,
        ranges: true,
        errorRecovery: inputDescriptor.options.checkMode
    }
    return inputDescriptor.script.isTS && (ret.plugins = ["typescript"]), ret
}
