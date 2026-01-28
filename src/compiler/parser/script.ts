import type { ParserOptions } from "@babel/parser"
import type { AssignmentExpression } from "@babel/types"
import type { ContextPattern } from "#type-declarations/estree"

import { inputDescriptor } from "../state"
import { isUndefined } from "../../util/shared/assert"
import { objectAssign } from "../../util/shared/aliases"
import { getPosByIndex } from "../../util/compiler/position"
import { parse, parseExpression as _parseExpression } from "@babel/parser"

export function parseExpression(source: string) {
    try {
        return _parseExpression(source, getParserOptions())
    } catch {}
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
            const sourcePosition = getPosByIndex(sourceStartIndex)
            if (!isUndefined(error.loc)) {
                objectAssign(error.loc, sourcePosition)
            }
            error.pos = sourceStartIndex
            error.message = error.message.replace(
                /\(\d+:\d+\)$/,
                `(${sourcePosition.line}:${sourcePosition.column})`
            )
            throw error
        }
    }
}

export function parsePattern(source: string): ContextPattern | null {
    try {
        const assignmentExpression = _parseExpression(source + "=_", {
            ...getParserOptions(),
            errorRecovery: false
        }) as AssignmentExpression
        switch (assignmentExpression.left.type) {
            case "Identifier":
            case "ArrayPattern":
            case "ObjectPattern": {
                return assignmentExpression.left
            }
            default: {
                return null
            }
        }
    } catch {
        return null
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
