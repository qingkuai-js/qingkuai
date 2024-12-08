import type { ASTLocation, ASTPosition } from "../../compiler/types"

import { newASTPosition } from "./structure"
import { inputDescriptor } from "../../compiler/state"

// 通过Script AST的索引换取script AST位置信息
export function getScriptPos(index: number) {
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

// 通过script AST中的行号换取生成代码中的行号
export function getGeneratedScriptLine(line: number) {
    return line + inputDescriptor.script.loc.start.line - 1
}

// 通过script AST中的索引换取源码中的索引
export function getSourceIndexByScriptIndex(index: number) {
    return index + inputDescriptor.script.loc.start.index
}

// 通过script AST中的ASTPosition换取源码中的ASTPosition
export function getSourcePosByScriptPos(pos: ASTPosition): ASTPosition {
    return getPosByIndex(getSourceIndexByScriptIndex(pos.index))
}

// 通过 script AST中的ASTLocation换取源码中的ASTLocation
export function getSourceLocByScriptLoc(loc: ASTLocation): ASTLocation {
    return {
        start: getPosByIndex(getSourceIndexByScriptIndex(loc.start.index)),
        end: getPosByIndex(getSourceIndexByScriptIndex(loc.end.index))
    }
}

// 生成获取位置相关的方法，需要传入依赖的位置信息列表
export function getLocationMethodsGen(baseon?: ASTPosition[]) {
    // 通过源码索引生成一个ASTPosition结构
    const getPosByIndex = (index: number): ASTPosition => {
        return (baseon || inputDescriptor.positions)[index]
    }

    // 通过源码索引生成一个带有默认结束位置的ASTLocation结构
    const getLocWithDefaultEnd = (index: number): ASTLocation => {
        return {
            start: getPosByIndex(index),
            end: newASTPosition()
        }
    }

    // 通过源码索引生成一个ASTLocation结构，未传入结束索引时开始和结束位置一致
    const getLocByIndex = (start: number, end?: number): ASTLocation => {
        return {
            start: getPosByIndex(start),
            end: getPosByIndex(end ?? start)
        }
    }

    return { getPosByIndex, getLocWithDefaultEnd, getLocByIndex }
}

export const { getPosByIndex, getLocWithDefaultEnd, getLocByIndex } = getLocationMethodsGen()
