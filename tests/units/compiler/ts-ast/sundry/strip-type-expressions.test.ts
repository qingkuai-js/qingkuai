import ts from "typescript"

import { expect, test } from "vitest"
import {
    findFirstChildUntil,
    getStriptTypeOperationsNode
} from "../../../../../src/compiler/ts-ast/sundry"
import { parseTsScript } from "../../../../../src/util/testing/ts-ast"

test("Function: stripTypeExpressions returns original node for non-type operation", () => {
    const sourceFile = parseTsScript("a + b")
    const binary = findFirstChildUntil(sourceFile, ts.isBinaryExpression)
    expect(binary).toBeTruthy()

    expect(getStriptTypeOperationsNode(binary!)).toBe(binary)
})

test("Function: stripTypeExpressions strips nested type operations", () => {
    const sourceFile = parseTsScript("const a = b as unknown as number")
    const asExpr = findFirstChildUntil(sourceFile, ts.isAsExpression)
    expect(asExpr).toBeTruthy()

    const stripped = getStriptTypeOperationsNode(asExpr!)
    expect(ts.isIdentifier(stripped)).toBeTruthy()
    expect((stripped as ts.Identifier).text).toBe("b")
})

test("Function: stripTypeExpressions strips non-null expression", () => {
    const sourceFile = parseTsScript("const a = b!")
    const nonNull = findFirstChildUntil(sourceFile, ts.isNonNullExpression)
    expect(nonNull).toBeTruthy()

    const stripped = getStriptTypeOperationsNode(nonNull!)
    expect(ts.isIdentifier(stripped)).toBeTruthy()
    expect((stripped as ts.Identifier).text).toBe("b")
})
