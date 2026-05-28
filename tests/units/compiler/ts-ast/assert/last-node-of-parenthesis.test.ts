import { expect, test } from "vitest"
import { isLastNodeOfParenthesis } from "../../../../../src/compiler/ts-ast/assert"
import { parseTsScript, findIdentifier } from "../../../../../src/util/testing/ts-ast"

function expectIsLastNodeOfParenthesis(source: string, name: string) {
    const sourceFile = parseTsScript(source)
    const node = findIdentifier(sourceFile, name)
    return expect(isLastNodeOfParenthesis(node), `source: "${source}", id: "${name}"`)
}

test("parenthesis last node: identifier directly wrapped by parenthesis", () => {
    expectIsLastNodeOfParenthesis("const a = (b)", "b").toBe(true)
})

test("parenthesis last node: nested parenthesis still returns true", () => {
    expectIsLastNodeOfParenthesis("const c = (((d)))", "d").toBe(true)
})

test("comma expression: direct right operand is last node", () => {
    expectIsLastNodeOfParenthesis("const e = (f, g)", "g").toBe(true)
})

test("comma expression: left operand is not last node", () => {
    expectIsLastNodeOfParenthesis("const h = (i, j)", "i").toBe(false)
})

test("comma expression: nested node in right subtree is not last node", () => {
    expectIsLastNodeOfParenthesis("const k = (l, m + n)", "n").toBe(false)
})

test("fallback: identifier in non-parenthesis and non-comma parent is false", () => {
    expectIsLastNodeOfParenthesis("const o = p + 1", "p").toBe(false)
})

test("fallback: source file node has no parent", () => {
    const sourceFile = parseTsScript("const q = r")
    expect(isLastNodeOfParenthesis(sourceFile)).toBe(false)
})
