import type { Range } from "#type-declarations/compiler"
import type { AnyNode, WithLoc } from "#type-declarations/estree"

import { PositionFlag } from "../enums"
import { isTypeOperation } from "./assert"
import { markPositionFlag } from "../../util/compiler/position"

export function stripTypeExpressions(node: AnyNode) {
    if (isTypeOperation(node)) {
        return stripTypeExpressions(node.expression)
    }
    return node
}

export function getStripedTypeAnnotationRange(node: AnyNode): Range {
    if (!("typeAnnotation" in node) || !node.typeAnnotation) {
        return node.range!
    }
    return [node.start!, node.typeAnnotation.start!]
}

export function markNeedSourcemap(node: WithLoc<AnyNode>, startSourceIndex: number) {
    const { Sourcemap, SourcemapEnd: sourceMapEnd, SourcemapStart } = PositionFlag
    markPositionFlag(sourceMapEnd | Sourcemap, startSourceIndex + node.end)
    markPositionFlag(SourcemapStart | Sourcemap, startSourceIndex + node.start)
}
