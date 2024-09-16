import type {
    AnyNode,
    EsPattern,
    PartialAnyNode,
    TraverseParent,
    TypeOperationExpression
} from "./types"
import type { Identifier } from "@babel/types"

// 节点类型断言
export function is<T extends AnyNode["type"]>(
    node: PartialAnyNode,
    type: T
): node is { type: T } & AnyNode {
    return node?.type === type
}

// 判断是否是函数节点
export function isFunctionNode(node: PartialAnyNode) {
    return (
        is(node, "FunctionDeclaration") ||
        is(node, "FunctionExpression") ||
        is(node, "ArrowFunctionExpression")
    )
}

// 判断是否estree pattern，用来过滤一些ts节点类型
export function isEsPattern(node: AnyNode): node is EsPattern {
    return (
        is(node, "Identifier") ||
        is(node, "RestElement") ||
        is(node, "ArrayPattern") ||
        is(node, "ObjectPattern") ||
        is(node, "MemberExpression") ||
        is(node, "AssignmentPattern")
    )
}

// 判断是否ts类型操作语法节点
export function isTypeOperationExpression(node: PartialAnyNode): node is TypeOperationExpression {
    return (
        is(node, "TSAsExpression") ||
        is(node, "TSTypeAssertion") ||
        is(node, "TSNonNullExpression") ||
        is(node, "TSSatisfiesExpression")
    )
}

// 识别标识符是否是引用
// 调用此方法只需传入原始节点和TraverseParent即可，无需将parent向上遍历查找es节点，这里已经考虑了ts节点的情况
export function identifierIsReference(node: Identifier, { v: parent }: TraverseParent): boolean {
    const notReferenceWhenParentIs = new Set<AnyNode["type"]>([
        "CatchClause",
        "ArrayPattern",
        "BreakStatement",
        "ClassExpression",
        "ClassDeclaration",
        "LabeledStatement",
        "ContinueStatement",
        "FunctionExpression",
        "FunctionDeclaration"
    ])

    if (!parent) {
        return true
    }
    if (parent.type.startsWith("TS")) {
        return false
    }

    switch (parent.type) {
        case "VariableDeclarator":
            return parent.id !== node
        case "ClassMethod":
        case "ObjectMethod":
            return parent.computed
        case "ObjectProperty":
            if (parent.shorthand) {
                return node !== parent.key
            }
            return parent.computed || parent.key !== node
        case "ClassProperty":
            return parent.computed || parent.key !== node
        case "MemberExpression":
            return parent.computed || parent.property !== node
        default:
            return !notReferenceWhenParentIs.has(parent.type)
    }
}
