import type { AnyNode } from "#type-declarations/estree"
import type { Range } from "#type-declarations/compiler"

import { isTypeOperation } from "./assert"

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
