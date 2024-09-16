import type { ASTPosition } from "../types"

import { recordMapping } from "./tools"
import { sourceMapInfo } from "../state"

// 记录未发生偏移的sourcemap信息
export function recordMappingWithNoOffset(position: ASTPosition) {
    const { line, column, index } = position
    if (!sourceMapInfo.positionShouldNotBeMapped[index]) {
        recordMapping(line, column, line, column, index)
    }
}
