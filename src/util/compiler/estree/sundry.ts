import type { AnyNode } from "#type-declarations/estree"

import { isTypeOperation } from "./assert"

export function stripTypeExpressions(node: AnyNode) {
    if (isTypeOperation(node)) {
        return stripTypeExpressions(node.expression)
    }
    return node
}
