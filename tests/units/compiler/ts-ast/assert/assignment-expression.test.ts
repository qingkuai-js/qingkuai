import ts from "typescript"

import { expect, test } from "vitest"
import { inputDescriptor } from "../../../../../src/compiler/state"
import { parseTsScript } from "../../../../../src/util/testing/ts-ast"
import { parseExpression } from "../../../../../src/compiler/parser/script"
import { findFirstChildUntil } from "../../../../../src/compiler/ts-ast/sundry"
import { isAssignmentExpression } from "../../../../../src/compiler/ts-ast/assert"

function expectIsAssignmentExpression(source: string) {
    const expression = parseExpression(source, 0)!
    inputDescriptor.script.isTS = true
    return expect(isAssignmentExpression(expression), `source: "${source}"`)
}

test("Wrapped assignment operators", () => {
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

test("Wrapped non-assignment operators", () => {
    expectIsAssignmentExpression("((a as number)) == 1").toBeFalsy()
    expectIsAssignmentExpression("((a satisfies number)) === 1").toBeFalsy()
    expectIsAssignmentExpression("((<number>a)) < 1").toBeFalsy()
    expectIsAssignmentExpression("((a as number)) > 1").toBeFalsy()
    expectIsAssignmentExpression("((a satisfies number)) + 1").toBeFalsy()
    expectIsAssignmentExpression("((<number>a)) * 1").toBeFalsy()
})

test("Pure non-assignment operators", () => {
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

test("Pure assignment operators", () => {
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

test("Destructuring assignment", () => {
    expectIsAssignmentExpression("[a, b] = [1, 2]").toBeTruthy()
    expectIsAssignmentExpression("({c, d: e} = {c: 1, d: 2})").toBeTruthy()
    expectIsAssignmentExpression("[f, ...g] = [1, 2, 3]").toBeTruthy()
    expectIsAssignmentExpression("[h, i] = [1, 2] as const").toBeTruthy()
    expectIsAssignmentExpression("({j, k} = {j: 1, k: 2} as const)").toBeTruthy()
    expectIsAssignmentExpression("[l, m] = [1, 2] satisfies number[]").toBeTruthy()
    expectIsAssignmentExpression("({n, o} = <{n: number, o: number}>{n: 1, o: 2})").toBeTruthy()
})

test("Non-binary expression is false", () => {
    const sourceFile = parseTsScript("a++")
    const node = findFirstChildUntil(sourceFile, ts.isPostfixUnaryExpression)
    expect(node, `source: \"a++\" should contain target node`).toBeTruthy()
    expect(isAssignmentExpression(node!)).toBeFalsy()
})
