import ts from "typescript"

import { expect, test } from "vitest"
import { parseTsScript } from "../../../../../src/util/testing/ts-ast"
import { findFirstChildUntil } from "../../../../../src/compiler/ts-ast/sundry"

test("Function: findFirstChildUntil returns first matched child", () => {
    const sourceFile = parseTsScript("a + b; c + d")
    const node = findFirstChildUntil(sourceFile, ts.isBinaryExpression)

    expect(node).toBeTruthy()
    expect(ts.isBinaryExpression(node!)).toBeTruthy()
    expect(node!.getText()).toBe("a + b")
})

test("Function: findFirstChildUntil returns null when no child matches", () => {
    const sourceFile = parseTsScript("a + b")
    const node = findFirstChildUntil(sourceFile, ts.isFunctionDeclaration)

    expect(node).toBeNull()
})
