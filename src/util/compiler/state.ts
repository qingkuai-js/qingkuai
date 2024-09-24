import type { ASTPosition } from "../../compiler/types"

import {
    debuggingInfo,
    sourceMapInfo,
    inputDescriptor,
    stringConstants,
    stringConstantsSourceMap
} from "../../compiler/state"
import { compilerOptions } from "../../compiler/configuration"

// 通过inputDescriptor.script.code部分的索引换取位置信息
export function getScriptLoc(index: number) {
    const {
        positions,
        script: {
            loc: { start: startLoc }
        }
    } = inputDescriptor
    const sourceLoc = positions[index + startLoc.index]

    const ret: ASTPosition = {
        index,
        line: 0,
        column: sourceLoc.column
    }

    ret.line = sourceLoc.line - startLoc.line + 1
    if (sourceLoc.line === startLoc.line) {
        ret.column -= startLoc.column
    }
    return ret
}

// 获取调试setter标识符
export function getSetterIdentifier(identifier: string) {
    return `_d${debuggingInfo.setters.get(identifier)}_`
}

// 生成指定数量的缩进字符
export function indent(n = 1) {
    return " ".repeat(inputDescriptor.indentSpaceCount * n)
}

// 通过源码中的行号获取生成代码行号
export function getGeneratedLine(line: number) {
    return line + inputDescriptor.script.loc.start.line - 2
}

// 此方法会记录字符串的访问次数，并生成一个变量（值为字符串字面量），最后返回生成的变量标识符
export function stringify(v: any) {
    const s = JSON.stringify(v)
    if (stringConstants.has(s)) {
        const existingItem = stringConstants.get(s)!
        existingItem.count++
        return existingItem.value
    } else {
        const value = `_s${stringConstants.size}_`
        stringConstants.set(s, {
            value,
            count: 1,
            using: false
        })
        stringConstantsSourceMap.set(value, s)
        return value
    }
}

// 标记某个片段不需要被映射
export function markSegmentShouldNotBeMapped(start: number, end: number) {
    if (compilerOptions.debugeMode) {
        for (let i = start; i < end; i++) {
            sourceMapInfo.positionShouldNotBeMapped[i] = true
        }
    }
}
