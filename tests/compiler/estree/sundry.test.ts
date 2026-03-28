import { expect, test } from "vitest"
import { parse, parseExpression } from "@babel/parser"

import {
    stripTypeExpressions,
    getStripedTypeAnnotationRange
} from "../../../src/compiler/estree/sundry"

const PARSE_OPTS = {
    sourceType: "module" as const,
    plugins: ["typescript"] as any,
    ranges: true
}

function expr(source: string): any {
    return parseExpression(source, PARSE_OPTS)
}

function stmt(source: string): any {
    return parse(source, PARSE_OPTS).program.body[0]
}

test("Function: stripTypeExpressions", () => {
    // 非类型操作节点原样返回
    // Non-type operation nodes are returned as-is
    const identifier = expr("foo")
    expect(stripTypeExpressions(identifier)).toBe(identifier)

    const member = expr("obj.foo")
    expect(stripTypeExpressions(member)).toBe(member)

    const literal = expr("1")
    expect(stripTypeExpressions(literal)).toBe(literal)

    // TSAsExpression → 剥离后返回底层节点
    // TSAsExpression (foo as any) should return the underlying node after stripping
    const asExpr = expr("foo as any")
    const stripped: any = stripTypeExpressions(asExpr)
    expect(stripped.type).toBe("Identifier")
    expect(stripped.name).toBe("foo")

    // TSNonNullExpression（foo!）
    const nonNull = expr("foo!")
    const strippedNonNull: any = stripTypeExpressions(nonNull)
    expect(strippedNonNull.type).toBe("Identifier")
    expect(strippedNonNull.name).toBe("foo")

    // TSSatisfiesExpression（foo satisfies T）
    const satisfies = expr("foo satisfies T")
    const strippedSatisfies: any = stripTypeExpressions(satisfies)
    expect(strippedSatisfies.type).toBe("Identifier")
    expect(strippedSatisfies.name).toBe("foo")

    // TSTypeAssertion（<T>foo）
    const typeAssertion = expr("<T>foo")
    const strippedTypeAssertion: any = stripTypeExpressions(typeAssertion)
    expect(strippedTypeAssertion.type).toBe("Identifier")
    expect(strippedTypeAssertion.name).toBe("foo")

    // 多层嵌套类型操作均被剥离
    // Multiple nested type operations should all be stripped
    const nested = expr("(foo as any)!")
    const strippedNested: any = stripTypeExpressions(nested)
    expect(strippedNested.type).toBe("Identifier")
    expect(strippedNested.name).toBe("foo")

    const deepNested = expr("((foo satisfies T) as any)!")
    const strippedDeep: any = stripTypeExpressions(deepNested)
    expect(strippedDeep.type).toBe("Identifier")
    expect(strippedDeep.name).toBe("foo")

    // 类型操作包裹成员表达式
    // MemberExpression wrapped in a type operation should return the MemberExpression after stripping
    const memberAs = expr("obj.foo as any")
    const strippedMember = stripTypeExpressions(memberAs)
    expect(strippedMember.type).toBe("MemberExpression")
})

test("Function: getStripedTypeAnnotationRange", () => {
    // 无类型标注的节点 → 返回 node.range
    const id = expr("foo")
    expect(getStripedTypeAnnotationRange(id)).toEqual(id.range)

    const memberExpr = expr("obj.foo")
    expect(getStripedTypeAnnotationRange(memberExpr)).toEqual(memberExpr.range)

    // 有类型标注的函数参数（Identifier + TSTypeAnnotation）
    // With type annotation: function parameter (Identifier + TSTypeAnnotation)
    //
    // source: "(x: string) => x", positions:
    //   0  1  2  3  4  5  6  7  8  9
    //   (  x  :     s  t  r  i  n  g  )  ...
    // x.start=1, typeAnnotation.start=2, x.range=[1, 9]
    //
    // 期望返回 [x.start, x.typeAnnotation.start] = [1, 2]
    // Expected to return [x.start, x.typeAnnotation.start] = [1, 2]
    const arrowParam = expr("(x: string) => x").params[0]
    expect(getStripedTypeAnnotationRange(arrowParam)).toEqual([
        arrowParam.start,
        arrowParam.typeAnnotation.start
    ])

    // 变量声明中带类型标注的 Identifier（let x: number）
    // Identifier with type annotation in variable declaration (let x: number)
    const varDeclarator = stmt("let x: number").declarations[0]
    const varId = varDeclarator.id
    expect(getStripedTypeAnnotationRange(varId)).toEqual([varId.start, varId.typeAnnotation.start])

    // 对象解构中带默认值+类型标注的参数
    // Destructured parameter with default value and type annotation
    //
    // source: "({ x }: T) => x"
    //
    // 整体参数有 typeAnnotation
    // The whole parameter has a typeAnnotation
    const destructuredParam = expr("({ x }: T) => x").params[0]
    expect(getStripedTypeAnnotationRange(destructuredParam)).toEqual([
        destructuredParam.start,
        destructuredParam.typeAnnotation.start
    ])

    // 函数参数无类型标注时 → 返回 node.range
    // When function parameter has no type annotation → return node.range
    const unannotatedParam = expr("(x) => x").params[0]
    expect(getStripedTypeAnnotationRange(unannotatedParam)).toEqual(unannotatedParam.range)
})
