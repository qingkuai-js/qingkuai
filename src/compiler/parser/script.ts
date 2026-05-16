import type { ParserOptions } from "@babel/parser"
import type { ArbitraryFunc } from "#type-declarations/tools"
import type { ArrayPattern, AssignmentExpression } from "@babel/types"

import { inputDescriptor } from "../state"
import { walkEstree } from "../estree/walk"
import { babelErrorLocInfoRE } from "../regular"
import { isUndefined } from "../../util/shared/assert"
import { objectAssign } from "../../util/shared/aliases"
import { getPosByIndex } from "../../util/compiler/position"
import { parse, parseExpression as _parseExpression } from "@babel/parser"

export function parseScript(source: string) {
    return correctErrorLocation(() => {
        return parse(
            source,
            getParserOptions({
                sourceType: "module"
            })
        ).program
    }, inputDescriptor.script.loc.start.index)
}

export function parseExpression(source: string, startSourceIndex: number) {
    return (
        correctErrorLocation(() => {
            return _parseExpression(source, getParserOptions())
        }, startSourceIndex) ?? null
    )
}

export function parseContextPattern(source: string): ArrayPattern | null {
    try {
        const expression = _parseExpression(`[${source}]=_`, {
            ...getParserOptions(),
            tokens: true,
            errorRecovery: false
        }) as AssignmentExpression

        if (expression.left.type !== "ArrayPattern") {
            return null
        }

        // 由于解析时添加了一个开始中括号前缀，这里需要将每个节点的位置信息向前移动一位
        // Since a prefix '[' was added during parsing, the position of each node needs to be shifted forward by one here.
        walkEstree(expression.left, {
            AnyNode(node) {
                if (!node.loc.end.column) {
                    node.loc.end.column--
                }
                if (!node.loc.start.column) {
                    node.loc.start.column--
                }
                node.loc.end.index = node.range[1] = --node.end
                node.loc.start.index = node.range[0] = --node.start
            }
        })
        return expression.left
    } catch {
        return null
    }
}

function getParserOptions(initial: ParserOptions = {}) {
    const ret: ParserOptions = {
        ...initial,
        ranges: true,
        errorRecovery: inputDescriptor?.options.checkMode
    }
    return (inputDescriptor?.script.isTS && (ret.plugins = ["typescript"]), ret)
}

function correctErrorLocation<T extends ArbitraryFunc>(
    fn: T,
    startSourceIndex: number
): ReturnType<T> | undefined {
    try {
        return fn()
    } catch (error: any) {
        // 非检查模式时将解析错误的位置信息修改为源码位置信息
        // Change the location information of parse error to the source location when not in check mode
        if (!inputDescriptor.options.checkMode) {
            const sourcePosition = getPosByIndex(startSourceIndex + error.pos)
            if (!isUndefined(error.loc)) {
                objectAssign(error.loc, sourcePosition)
            }
            error.pos = sourcePosition.index
            error.message = error.message.replace(
                babelErrorLocInfoRE,
                `(${sourcePosition.line}:${sourcePosition.column})`
            )
            Error.captureStackTrace(error)
            throw error
        }
    }
}
