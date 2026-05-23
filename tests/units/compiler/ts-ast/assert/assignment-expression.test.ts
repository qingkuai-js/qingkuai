import ts from "typescript"

import { expect, test } from "vitest"
import { walkTsNode } from "../../../../../src/compiler/ts-ast/walk"
import { parseTsScript } from "../../../../../src/util/testing/ts-ast"
import { findFirstChildUntil } from "../../../../../src/compiler/ts-ast/sundry"
import { isAssignmentExpression } from "../../../../../src/compiler/ts-ast/assert"

function expectIsAssignmentExpression(source: string) {
    const sourceFile = parseTsScript(source)
    const node = findFirstChildUntil(sourceFile, ts.isBinaryExpression)
    expect(node, `source: "${source}" should contain binary expression`).toBeTruthy()
    return expect(isAssignmentExpression(node!), `source: "${source}"`)
}

function collectBinaryExpressions(source: string) {
    const sourceFile = parseTsScript(source)
    const result: ts.BinaryExpression[] = []
    walkTsNode(sourceFile, node => {
        if (ts.isBinaryExpression(node)) {
            result.push(node)
        }
    })
    return result
}

test("Assignment: wrapped assignment operators", () => {
    expectIsAssignmentExpression("a = 1").toBeTruthy()
    expectIsAssignmentExpression("((a as number)) += 1").toBeTruthy()
    expectIsAssignmentExpression("((a satisfies number)) -= 1").toBeTruthy()
    expectIsAssignmentExpression("((<number>a)) *= 1").toBeTruthy()
    expectIsAssignmentExpression("(a!) **= 1").toBeTruthy()
    expectIsAssignmentExpression("((a)) /= 1").toBeTruthy()
    expectIsAssignmentExpression("(((a))) %= 1").toBeTruthy()
    expectIsAssignmentExpression("((a as number)) &= 1").toBeTruthy()
    expectIsAssignmentExpression("((a satisfies number)) &&= 1").toBeTruthy()
    expectIsAssignmentExpression("((<number>a)) |= 1").toBeTruthy()
    expectIsAssignmentExpression("(a!) ||= 1").toBeTruthy()
    expectIsAssignmentExpression("((a)) ??= 1").toBeTruthy()
    expectIsAssignmentExpression("(((a))) ^= 1").toBeTruthy()
    expectIsAssignmentExpression("((a as number)) <<= 1").toBeTruthy()
    expectIsAssignmentExpression("((a satisfies number)) >>= 1").toBeTruthy()
    expectIsAssignmentExpression("((<number>a)) >>>= 1").toBeTruthy()
})

test("Assignment: wrapped non-assignment operators", () => {
    expectIsAssignmentExpression("((a as number)) == 1").toBeFalsy()
    expectIsAssignmentExpression("((a satisfies number)) === 1").toBeFalsy()
    expectIsAssignmentExpression("((<number>a)) < 1").toBeFalsy()
    expectIsAssignmentExpression("((a as number)) > 1").toBeFalsy()
    expectIsAssignmentExpression("((a satisfies number)) + 1").toBeFalsy()
    expectIsAssignmentExpression("((<number>a)) * 1").toBeFalsy()
})

test("Assignment: pure non-assignment operators", () => {
    expectIsAssignmentExpression("a + b").toBeFalsy()
    expectIsAssignmentExpression("a * b").toBeFalsy()
    expectIsAssignmentExpression("a - b").toBeFalsy()
    expectIsAssignmentExpression("a === b").toBeFalsy()
    expectIsAssignmentExpression("a == b").toBeFalsy()
    expectIsAssignmentExpression("a !== b").toBeFalsy()
    expectIsAssignmentExpression("a < b").toBeFalsy()
    expectIsAssignmentExpression("a || b").toBeFalsy()
    expectIsAssignmentExpression("a && b").toBeFalsy()
    expectIsAssignmentExpression("a ?? b").toBeFalsy()
    expectIsAssignmentExpression("a & b").toBeFalsy()
    expectIsAssignmentExpression("a | b").toBeFalsy()
    expectIsAssignmentExpression("a ^ b").toBeFalsy()
    expectIsAssignmentExpression("a << b").toBeFalsy()
    expectIsAssignmentExpression("a >> b").toBeFalsy()
    expectIsAssignmentExpression("a >>> b").toBeFalsy()
})

test("Assignment: pure assignment operators", () => {
    expectIsAssignmentExpression("a = 1").toBeTruthy()
    expectIsAssignmentExpression("b += 1").toBeTruthy()
    expectIsAssignmentExpression("c -= 1").toBeTruthy()
    expectIsAssignmentExpression("d *= 1").toBeTruthy()
    expectIsAssignmentExpression("e **= 1").toBeTruthy()
    expectIsAssignmentExpression("f /= 1").toBeTruthy()
    expectIsAssignmentExpression("g %= 1").toBeTruthy()
    expectIsAssignmentExpression("h &= 1").toBeTruthy()
    expectIsAssignmentExpression("i &&= 1").toBeTruthy()
    expectIsAssignmentExpression("j |= 1").toBeTruthy()
    expectIsAssignmentExpression("k ||= 1").toBeTruthy()
    expectIsAssignmentExpression("l ??= 1").toBeTruthy()
    expectIsAssignmentExpression("m ^= 1").toBeTruthy()
    expectIsAssignmentExpression("n <<= 1").toBeTruthy()
    expectIsAssignmentExpression("o >>= 1").toBeTruthy()
    expectIsAssignmentExpression("p >>>= 1").toBeTruthy()
})

test("Assignment: non-binary expression is false", () => {
    const sourceFile = parseTsScript("a++")
    const node = findFirstChildUntil(sourceFile, ts.isPostfixUnaryExpression)
    expect(node, `source: \"a++\" should contain target node`).toBeTruthy()
    expect(isAssignmentExpression(node!)).toBeFalsy()
})

test("Assignment: walk-context operator mix in script block", () => {
    const binaries = collectBinaryExpressions(`
        let a = 0
        const b = { c: 1 }
        a += b.c
        b.c &&= a
        if (a > 0) {
            b.c = a
        }
    `)

    const assignmentKinds = new Set([
        ts.SyntaxKind.EqualsToken,
        ts.SyntaxKind.PlusEqualsToken,
        ts.SyntaxKind.AmpersandAmpersandEqualsToken
    ])
    for (const node of binaries) {
        const actual = isAssignmentExpression(node)
        const expected = assignmentKinds.has(node.operatorToken.kind)
        expect(actual, `operator: ${ts.SyntaxKind[node.operatorToken.kind]}`).toBe(expected)
    }
})
