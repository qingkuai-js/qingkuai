import ts from "typescript"

import { expect, test } from "vitest"
import { parseTsScript } from "../../../../../src/util/testing/ts-ast"
import { isUpdateExpression } from "../../../../../src/compiler/ts-ast/assert"
import { findFirstChildUntil } from "../../../../../src/compiler/ts-ast/sundry"
import { walkTsNode } from "../../../../../src/compiler/ts-ast/walk"

function expectIsUpdateExpression<T extends ts.Node>(
    source: string,
    predicate: (node: ts.Node) => node is T
) {
    const sourceFile = parseTsScript(source)
    const node = findFirstChildUntil(sourceFile, predicate)
    expect(node, `source: "${source}" should contain target node`).toBeTruthy()
    return expect(isUpdateExpression(node!), `source: "${source}"`)
}

function collectUnaryExpressions(source: string) {
    const sourceFile = parseTsScript(source)
    const result: Array<ts.PrefixUnaryExpression | ts.PostfixUnaryExpression> = []
    walkTsNode(sourceFile, node => {
        if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
            result.push(node)
        }
    })
    return result
}

test("update expression: postfix increment", () => {
    expectIsUpdateExpression("a++", ts.isPostfixUnaryExpression).toBeTruthy()
})

test("update expression: prefix increment", () => {
    expectIsUpdateExpression("++b", ts.isPrefixUnaryExpression).toBeTruthy()
})

test("update expression: postfix decrement", () => {
    expectIsUpdateExpression("c--", ts.isPostfixUnaryExpression).toBeTruthy()
})

test("update expression: prefix decrement", () => {
    expectIsUpdateExpression("--d", ts.isPrefixUnaryExpression).toBeTruthy()
})

test("update expression: plain binary is false", () => {
    expectIsUpdateExpression("e + 1", ts.isBinaryExpression).toBeFalsy()
})

test("update expression: other unary operators are false", () => {
    expectIsUpdateExpression("+f", ts.isPrefixUnaryExpression).toBeFalsy()
    expectIsUpdateExpression("-g", ts.isPrefixUnaryExpression).toBeFalsy()
})

test("Update: walk-context unary mix in loop", () => {
    const nodes = collectUnaryExpressions(`
        let a = 0
        while (a < 2) {
            a++
            ++a
            +a
            -a
        }
    `)

    for (const node of nodes) {
        const expected =
            node.operator === ts.SyntaxKind.PlusPlusToken ||
            node.operator === ts.SyntaxKind.MinusMinusToken
        expect(isUpdateExpression(node)).toBe(expected)
    }
})
