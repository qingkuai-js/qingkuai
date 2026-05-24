import type { Range } from "#type-declarations/compiler"

import ts from "typescript"

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

export function markNeedSourcemap(node: ts.Node, startSourceIndex: number) {
    markPositionFlag(PositionFlag.SourcemapEnd, startSourceIndex + node.getEnd())
    markPositionFlag(PositionFlag.SourcemapStart, startSourceIndex + node.getStart())
}
