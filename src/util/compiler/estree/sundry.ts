import type { AnyNode } from "#type-declarations/estree"

import { isTypeExpression } from "./assert"

export function stripTypeExpressions(node: AnyNode) {
    if (isTypeExpression(node)) {
        return stripTypeExpressions(node.expression)
    }
    return node
}
