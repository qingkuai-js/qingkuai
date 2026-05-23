import ts from "typescript"

import { expect, test } from "vitest"
import { parseTsScript } from "../../../../../src/util/testing/ts-ast"
import { isContextPattern } from "../../../../../src/compiler/ts-ast/assert"
import { findFirstChildUntil } from "../../../../../src/compiler/ts-ast/sundry"

function expectIsContextPattern<T extends ts.Node>(
    source: string,
    predicate: (node: ts.Node) => node is T
) {
    const sourceFile = parseTsScript(source)
    const node = findFirstChildUntil(sourceFile, predicate)
    expect(node, `source: "${source}" should contain target node`).toBeTruthy()
    return expect(isContextPattern(node!), `source: "${source}"`)
}

test("context pattern: identifier", () => {
    expectIsContextPattern("const a = 1", ts.isIdentifier).toBeTruthy()
})

test("context pattern: array binding pattern", () => {
    expectIsContextPattern("const [a] = list", ts.isArrayBindingPattern).toBeTruthy()
})

test("context pattern: object binding pattern", () => {
    expectIsContextPattern("const { a } = obj", ts.isObjectBindingPattern).toBeTruthy()
})

test("context pattern: property access is false", () => {
    expectIsContextPattern("obj.a", ts.isPropertyAccessExpression).toBeFalsy()
})

test("context pattern: binary expression is false", () => {
    expectIsContextPattern("a + b", ts.isBinaryExpression).toBeFalsy()
})

test("context pattern: binding element is false", () => {
    expectIsContextPattern("const [a] = b", ts.isBindingElement).toBeFalsy()
})
