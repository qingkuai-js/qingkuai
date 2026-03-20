import type { Range } from "#type-declarations/compiler"
import type { ASTLocation, ASTPosition, ASTPositionWithFlag } from "#type-declarations/compiler"

import { PositionFlag } from "../../compiler/enums"
import { whitespaceRE } from "../../compiler/regular"
import { inputDescriptor } from "../../compiler/state"

export function newASTPosition(): ASTPosition {
    return { index: -1, line: -1, column: -1 }
}

export function newASTLocation(): ASTLocation {
    const position = newASTPosition()
    return { start: position, end: position }
}

// 获取每一个字符的位置信息（行列及索引）
// Get the position information of each character (line, column, and index)
export function getPositionOfEachChar(str: string) {
    let line = 1
    let column = 0
    let char = str[0]
    const ret: ASTPositionWithFlag[] = []
    for (let i = 0; i <= str.length; char = str[++i]) {
        ret.push({ line, column, index: i, flag: 0 })
        if (char !== "\n") {
            column++
        } else {
            line++
            column = 0
        }
    }
    return ret
}

export function getScriptLocByRange(range: Range) {
    const delta = inputDescriptor.script.loc.start.index
    return getLocByIndex(range[0] + delta, range[1] + delta)
}

export function getRangeByLocation(loc: ASTLocation): Range {
    return [loc.start.index, loc.end.index]
}

export function getLocWithDefaultEnd(index: number): ASTLocation {
    return { start: getPosByIndex(index), end: newASTPosition() }
}

export function getPosByIndex(index: number): ASTPosition {
    return (({ flag, ...rest }) => rest)(inputDescriptor.positions[index])
}

export function isPositionFlagSetAtIndex(flag: PositionFlag, index: number) {
    return !!(inputDescriptor.positions[index].flag & flag)
}

export function isPositionFlagSetAtPos(flag: PositionFlag, pos: ASTPosition) {
    return isPositionFlagSetAtIndex(flag, pos.index)
}

export function isPositionFlagSetInLoc(flag: PositionFlag, loc: ASTLocation) {
    for (let i = loc.start.index; i < loc.end.index; i++) {
        if (!isPositionFlagSetAtIndex(flag, i)) {
            return false
        }
    }
    return true
}

export function getLocByIndex(start: number, end: number = start): ASTLocation {
    return { start: getPosByIndex(start), end: getPosByIndex(end) }
}

export function markPositionFlag(flag: PositionFlag, start: number, end = start) {
    for (let i = start; i <= end; i++) {
        inputDescriptor.positions[i].flag |= flag
    }
}

export function getNonWhiteSpaceLocByLoc(loc: ASTLocation) {
    return getNonWhitespaceLocByIndex(loc.start.index, loc.end.index)
}

export function getNonWhitespaceLocByIndex(start: number, end: number) {
    const originalStart = start
    while (start < end) {
        if (!whitespaceRE.test(inputDescriptor.source[start])) {
            break
        }
        start++
    }
    while (end > start) {
        if (!whitespaceRE.test(inputDescriptor.source[end - 1])) {
            break
        }
        end--
    }
    return start === end ? getLocByIndex(originalStart) : getLocByIndex(start, end)
}
