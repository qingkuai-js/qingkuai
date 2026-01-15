import type { Program } from "@babel/types"
import type { ParserOptions } from "@babel/parser"

import { parse } from "@babel/parser"
import { inputDescriptor } from "../state"
import { isUndefined } from "../../util/shared/assert"
import { objectAssign } from "../../util/shared/aliases"
import { getPosByIndex } from "../../util/compiler/position"

export function parseScript(source: string, startSourceIndex = 0, prefix = "") {
    const isCheckMode = inputDescriptor.options.checkMode
    try {
        const parserOptions: ParserOptions = {
            ranges: true,
            sourceType: "module",
            errorRecovery: isCheckMode
        }
        if (inputDescriptor.script.isTS) {
            parserOptions.plugins = ["typescript"]
        }
        return parse(prefix + source, parserOptions).program as Program
    } catch (err: any) {
        if (!isCheckMode) {
            // 将解析错误的位置信息修改为源码位置信息
            // Change the location information of parse error to the source location
            const pos = (err.pos - prefix.length) as number
            const sourceIndex = (err.pos = startSourceIndex + pos)
            const sourcePosition = getPosByIndex(sourceIndex)
            if (!isUndefined(err.loc)) {
                objectAssign(err.loc, sourcePosition)
            }
            err.pos = sourceIndex
            err.message = err.message.replace(
                /\(\d+:\d+\)$/,
                `(${sourcePosition.line}:${sourcePosition.column})`
            )
            throw err
        }
    }
}
