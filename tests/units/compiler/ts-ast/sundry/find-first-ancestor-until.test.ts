import ts from "typescript"

import { expect, test } from "vitest"
import { findFirstAncestorUntil } from "../../../../../src/compiler/ts-ast/sundry"
import { findIdentifier, parseTsScript } from "../../../../../src/util/testing/ts-ast"

test("Function: findFirstAncestorUntil returns first matched ancestor", () => {
    const sourceFile = parseTsScript("a + b")
    const a = findIdentifier(sourceFile, "a")
    const ancestor = findFirstAncestorUntil(a, ts.isBinaryExpression)

    expect(ancestor).toBeTruthy()
    expect(ts.isBinaryExpression(ancestor!)).toBeTruthy()
})

test("Function: findFirstAncestorUntil returns null when no ancestor matches", () => {
    const sourceFile = parseTsScript("a + b")
    const a = findIdentifier(sourceFile, "a")
    const ancestor = findFirstAncestorUntil(a, ts.isClassDeclaration)

    expect(ancestor).toBeNull()
})
