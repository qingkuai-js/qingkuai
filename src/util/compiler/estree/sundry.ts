import type { Range } from "#type-declarations/compiler"
import type { AnyNode, WithLoc } from "#type-declarations/estree"

import { isTypeOperation } from "./assert"
import { markPositionFlag } from "../position"
import { PositionFlag } from "../../../compiler/enums"

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
    markPositionFlag(PositionFlag.Sourcemap, startSourceIndex + node.end)
    markPositionFlag(PositionFlag.Sourcemap, startSourceIndex + node.start)
}
