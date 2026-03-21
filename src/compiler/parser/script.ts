import type { ParserOptions } from "@babel/parser"
import type { AssignmentExpression } from "@babel/types"
import type { ContextPattern } from "#type-declarations/estree"

import { inputDescriptor } from "../state"
import { babelErrorLocInfoRE } from "../regular"
import { isUndefined } from "../../util/shared/assert"
import { objectAssign } from "../../util/shared/aliases"
import { getPosByIndex } from "../../util/compiler/position"
import { parse, parseExpression as _parseExpression } from "@babel/parser"

export function parseExpression(source: string) {
    return _parseExpression(source, getParserOptions())
}

export function parseScript(source: string) {
    try {
        return parse(
            source,
            getParserOptions({
                sourceType: "module"
            })
        ).program
    } catch (error: any) {
        if (!inputDescriptor.options.checkMode) {
            // 将解析错误的位置信息修改为源码位置信息
            // Change the location information of parse error to the source location
            const sourceStartIndex = inputDescriptor.script.loc.start.index
            const sourcePosition = getPosByIndex(sourceStartIndex + error.pos)
            if (!isUndefined(error.loc)) {
                objectAssign(error.loc, sourcePosition)
            }
            error.pos = sourcePosition.index
            error.message = error.message.replace(
                babelErrorLocInfoRE,
                ""
                // `(${sourcePosition.line}:${sourcePosition.column})`
            )
            Error.captureStackTrace(error)
            throw error
        }
    }
}

export function parseContextPattern(source: string): ContextPattern | null {
    const { left: pattern, right } = _parseExpression(source + "=_", {
        ...getParserOptions(),
        tokens: true,
        errorRecovery: false
    }) as AssignmentExpression
    switch (pattern.type) {
        case "Identifier":
        case "ArrayPattern":
        case "ObjectPattern": {
            if (right.type === "Identifier" && right.name === "_") {
                return pattern
            }
            // fallthrough
        }
        default: {
            return null
        }
    }
}

function getParserOptions(initial: ParserOptions = {}) {
    const ret: ParserOptions = {
        ...initial,
        ranges: true,
        errorRecovery: inputDescriptor.options.checkMode
    }
    return (inputDescriptor.script.isTS && (ret.plugins = ["typescript"]), ret)
}
