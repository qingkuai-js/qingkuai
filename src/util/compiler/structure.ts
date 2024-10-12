import type { ASTLocation, ASTPosition } from "../../compiler/types"

import { isUndefined } from "../shared/assert"

// 生成一个默认的ASTPosition结构
export function newASTPosition(): ASTPosition {
    return {
        line: 0,
        column: 0,
        index: 0
    }
}

// 生成一个默认的ASTLocation结构
export function newASTLocation(): ASTLocation {
    const pos = newASTPosition()
    return {
        start: pos,
        end: pos
    }
}

// 生成一个带有位置信息的值结构
export function newValueWithLoc<T>(value: T, loc?: ASTLocation) {
    if (isUndefined(loc)) {
        loc = newASTLocation()
    }
    return { value, loc }
}
