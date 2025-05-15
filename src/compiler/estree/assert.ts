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

// 判断表达式是否是内联事件处理器
export function isInlineEventHandler(node: AnyNode) {
    return !(
        isFunctionNode(node) ||
        is(node, "Identifier") ||
        is(node, "MemberExpression") ||
        is(node, "OptionalMemberExpression") ||
        is(node, "OptionalIndexedAccessType")
    )
}

// 判断是否是函数节点
export function isFunctionNode(node: PartialAnyNode) {
    return (
        is(node, "FunctionDeclaration") ||
        is(node, "FunctionExpression") ||
        is(node, "ArrowFunctionExpression")
    )
}

export function findAncestorUntil<T extends AnyNode["type"]>(
    tp: TraverseParent,
    type: T
): (AnyNode & { type: T }) | undefined {
    if (!tp.v) {
        return undefined
    }
    if (tp.v.type === type) {
        return tp.v as any
    }
    if (!tp.parent) {
        return undefined
    }
    return findAncestorUntil(tp.parent, type)
}

// 判断节点是否为可赋值目标（左值）
export function isAssignable(node: AnyNode) {
    return is(node, "Identifier") || is(node, "MemberExpression")
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
export function identifierIsReference(node: Identifier, tp: TraverseParent): boolean {
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

    if (!tp.v) {
        return true
    }
    if (tp.v.type.startsWith("TS")) {
        return false
    }

    switch (tp.v.type) {
        case "VariableDeclarator":
            return tp.v.id !== node
        case "ClassMethod":
        case "ObjectMethod":
            return tp.v.computed
        case "ObjectProperty":
            if (findAncestorUntil(tp, "ObjectPattern")) {
                return false
            }
            if (tp.v.shorthand) {
                return node !== tp.v.key
            }
            return tp.v.computed || tp.v.key !== node
        case "ClassProperty":
            return tp.v.computed || tp.v.key !== node
        case "MemberExpression":
            return tp.v.computed || tp.v.property !== node
        default:
            return !notReferenceWhenParentIs.has(tp.v.type)
    }
}
