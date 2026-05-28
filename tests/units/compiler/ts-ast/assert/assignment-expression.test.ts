import ts from "typescript"

import { expect, test } from "vitest"
import {
    isLiteral,
    isPropertyEqual,
    isExpressionEqual,
    isAssignmentExpression
} from "../../../../../src/compiler/ts-ast/assert"
import { inputDescriptor } from "../../../../../src/compiler/state"
import { walkTsNode } from "../../../../../src/compiler/ts-ast/walk"
import { parseTsScript } from "../../../../../src/util/testing/ts-ast"
import { parseExpression } from "../../../../../src/compiler/parser/script"
import { findFirstChildUntil } from "../../../../../src/compiler/ts-ast/sundry"

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

test("Literal detection: comma expression follows right operand", () => {
    const sourceFile = parseTsScript("const a = (foo, undefined)")
    const binary = findFirstChildUntil(sourceFile, ts.isBinaryExpression)

    expect(binary).toBeTruthy()
    expect(isLiteral(binary!)).toBe(true)
})

test("Property equality: literal text and unsupported nodes", () => {
    const literalSource = parseTsScript("`x`; 'x'")
    const templateLiteral = findFirstChildUntil(literalSource, ts.isNoSubstitutionTemplateLiteral)
    const stringLiteral = findFirstChildUntil(literalSource, ts.isStringLiteral)
    expect(templateLiteral).toBeTruthy()
    expect(stringLiteral).toBeTruthy()
    expect(isPropertyEqual(templateLiteral!, stringLiteral!)).toBe(true)

    const unsupportedSource = parseTsScript("a + b; x")
    const unsupported = findFirstChildUntil(unsupportedSource, ts.isBinaryExpression)
    const identifier = findFirstChildUntil(unsupportedSource, (node): node is ts.Identifier => {
        return ts.isIdentifier(node) && node.text === "x"
    })
    expect(unsupported).toBeTruthy()
    expect(identifier).toBeTruthy()
    expect(isPropertyEqual(unsupported!, identifier!)).toBe(false)
})

test("Expression equality: element access and unsupported same-kind nodes", () => {
    const elementSource = parseTsScript("a[b]; a[b]")
    const elementAccesses: ts.ElementAccessExpression[] = []
    walkTsNode(elementSource, node => {
        if (ts.isElementAccessExpression(node)) {
            elementAccesses.push(node)
        }
    })
    expect(elementAccesses.length).toBe(2)
    expect(isExpressionEqual(elementAccesses[0]!, elementAccesses[1]!)).toBe(true)

    const binarySource = parseTsScript("a + b; a + b")
    const binaries: ts.BinaryExpression[] = []
    walkTsNode(binarySource, node => {
        if (ts.isBinaryExpression(node)) {
            binaries.push(node)
        }
    })
    expect(binaries.length).toBe(2)
    expect(isExpressionEqual(binaries[0]!, binaries[1]!)).toBe(false)

    const idSource = parseTsScript("a; a")
    const ids: ts.Identifier[] = []
    walkTsNode(idSource, node => {
        if (ts.isIdentifier(node) && node.text === "a") {
            ids.push(node)
        }
    })
    expect(ids.length).toBe(2)
    expect(isExpressionEqual(ids[0]!, ids[1]!)).toBe(true)
})
