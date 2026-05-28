import { expect, test } from "vitest"
import { findIdentifier, parseTsScript } from "../../../../../src/util/testing/ts-ast"
import { isIdentifierAssignmentTarget } from "../../../../../src/compiler/ts-ast/assert"

function expectIdentifierAssignmentTargets(
    source: string,
    assignmentTargets: string[] = ["a"],
    nonAssignmentTargets: string[] = []
) {
    const sourceFile = parseTsScript(source)

    for (const identifierText of assignmentTargets) {
        const identifier = findIdentifier(sourceFile, identifierText)
        expect(
            isIdentifierAssignmentTarget(identifier),
            `identifier "${identifierText}" in: "${source}"`
        ).toBeTruthy()
    }

    for (const identifierText of nonAssignmentTargets) {
        const identifier = findIdentifier(sourceFile, identifierText)
        expect(
            isIdentifierAssignmentTarget(identifier),
            `identifier "${identifierText}" in: "${source}"`
        ).toBeFalsy()
    }
}

test("Basic assignment operators", () => {
    expectIdentifierAssignmentTargets("a = 1")
    expectIdentifierAssignmentTargets("a += 1")
    expectIdentifierAssignmentTargets("a -= 1")
    expectIdentifierAssignmentTargets("a *= 1")
    expectIdentifierAssignmentTargets("a **= 1")
    expectIdentifierAssignmentTargets("a /= 1")
    expectIdentifierAssignmentTargets("a %= 1")
    expectIdentifierAssignmentTargets("a &= 1")
    expectIdentifierAssignmentTargets("a &&= 1")
    expectIdentifierAssignmentTargets("a |= 1")
    expectIdentifierAssignmentTargets("a ||= 1")
    expectIdentifierAssignmentTargets("a ??= 1")
    expectIdentifierAssignmentTargets("a ^= 1")
    expectIdentifierAssignmentTargets("a <<= 1")
    expectIdentifierAssignmentTargets("a >>= 1")
    expectIdentifierAssignmentTargets("a >>>= 1")
})

test("Update expressions", () => {
    expectIdentifierAssignmentTargets("a++")
    expectIdentifierAssignmentTargets("++a")
    expectIdentifierAssignmentTargets("a--")
    expectIdentifierAssignmentTargets("--a")
})

test("For-in and for-of initializers", () => {
    expectIdentifierAssignmentTargets("for (let a in obj) {}", [], ["a"])
    expectIdentifierAssignmentTargets("for (const a of arr) {}", [], ["a"])
    expectIdentifierAssignmentTargets("for (var a in obj) {}", [], ["a"])
})

test("Destructuring array assignment", () => {
    expectIdentifierAssignmentTargets("[a, b] = [1, 2]", ["a", "b"])
    expectIdentifierAssignmentTargets("[a, ...b] = [1, 2, 3]", ["a", "b"])
})

test("Destructuring object assignment", () => {
    expectIdentifierAssignmentTargets("({a, b} = {a: 1, b: 2})", ["a", "b"])
    expectIdentifierAssignmentTargets("({a: x, b: y} = {a: 1, b: 2})", ["x", "y"])
})

test("Nested destructuring assignment", () => {
    expectIdentifierAssignmentTargets("([a, [b, c]] = [1, [2, 3]])", ["a", "b", "c"])
    expectIdentifierAssignmentTargets("({x: {a, b}} = {x: {a: 1, b: 2}})", ["a", "b"])
})

test("Type operations with assignment", () => {
    expectIdentifierAssignmentTargets("(a as number) = 1")
    expectIdentifierAssignmentTargets("(a satisfies number) = 1")
    expectIdentifierAssignmentTargets("((<number>a)) = 1")
    expectIdentifierAssignmentTargets("(a!) = 1")
    expectIdentifierAssignmentTargets("((a as number)!) = 1")
    expectIdentifierAssignmentTargets("((<number>a) satisfies number) = 1")
})

test("Type operations with update expressions", () => {
    expectIdentifierAssignmentTargets("++(a as number)")
    expectIdentifierAssignmentTargets("--(a satisfies number)")
    expectIdentifierAssignmentTargets("++(<number>a)")
    expectIdentifierAssignmentTargets("--(a!)")
    expectIdentifierAssignmentTargets("++((a as number)!)")
    expectIdentifierAssignmentTargets("--((<number>a) satisfies number)")
})

test("Parenthesized expressions with assignment", () => {
    expectIdentifierAssignmentTargets("(a) = 1")
    expectIdentifierAssignmentTargets("((a)) = 1")
    expectIdentifierAssignmentTargets("(((a))) = 1")
    expectIdentifierAssignmentTargets("(a) += 1")
    expectIdentifierAssignmentTargets("((a)) -= 1")
})

test("Parenthesized expressions with update", () => {
    expectIdentifierAssignmentTargets("(a++)")
    expectIdentifierAssignmentTargets("((++a))")
    expectIdentifierAssignmentTargets("((a--))")
    expectIdentifierAssignmentTargets("(--a)")
})

test("Parenthesized expressions with destructuring", () => {
    expectIdentifierAssignmentTargets("([a, b]) = [1, 2]", ["a", "b"])
    expectIdentifierAssignmentTargets("(({x, y}) = {x: 1, y: 2})", ["x", "y"])
})

test("Combined type operations, parentheses and assignment", () => {
    expectIdentifierAssignmentTargets("((a as number)) = 1")
    expectIdentifierAssignmentTargets("(((a satisfies number))) = 1")
    expectIdentifierAssignmentTargets("(((<number>a))) = 1")
    expectIdentifierAssignmentTargets("((a!)) = 1")
    expectIdentifierAssignmentTargets("(((a as number)!)) = 1")
})

test("Combined type operations, parentheses and update", () => {
    expectIdentifierAssignmentTargets("++(((a as number)))")
    expectIdentifierAssignmentTargets("--(((a satisfies number)))")
    expectIdentifierAssignmentTargets("++(((<number>a)))")
    expectIdentifierAssignmentTargets("--(((a!)))")
    expectIdentifierAssignmentTargets("++((((a as number)!)))")
})

test("Assignment right-hand side identifiers are not targets", () => {
    expectIdentifierAssignmentTargets("a = 1", ["a"])
    expectIdentifierAssignmentTargets("a + 1", [], ["a"])
    expectIdentifierAssignmentTargets("a = b", ["a"], ["b"])
    expectIdentifierAssignmentTargets("[x] = [a]", ["x"], ["a"])
})

test("Binary expressions without assignment", () => {
    expectIdentifierAssignmentTargets("a + 1", [], ["a"])
    expectIdentifierAssignmentTargets("a * 2", [], ["a"])
    expectIdentifierAssignmentTargets("a - 3", [], ["a"])
    expectIdentifierAssignmentTargets("a / 4", [], ["a"])
    expectIdentifierAssignmentTargets("a % 5", [], ["a"])
    expectIdentifierAssignmentTargets("a ** 2", [], ["a"])
    expectIdentifierAssignmentTargets("a & 1", [], ["a"])
    expectIdentifierAssignmentTargets("a | 1", [], ["a"])
    expectIdentifierAssignmentTargets("a ^ 1", [], ["a"])
    expectIdentifierAssignmentTargets("a << 1", [], ["a"])
    expectIdentifierAssignmentTargets("a >> 1", [], ["a"])
    expectIdentifierAssignmentTargets("a >>> 1", [], ["a"])
})

test("Comparison expressions", () => {
    expectIdentifierAssignmentTargets("a === 1", [], ["a"])
    expectIdentifierAssignmentTargets("a == 1", [], ["a"])
    expectIdentifierAssignmentTargets("a !== 1", [], ["a"])
    expectIdentifierAssignmentTargets("a != 1", [], ["a"])
    expectIdentifierAssignmentTargets("a < 1", [], ["a"])
    expectIdentifierAssignmentTargets("a > 1", [], ["a"])
    expectIdentifierAssignmentTargets("a <= 1", [], ["a"])
    expectIdentifierAssignmentTargets("a >= 1", [], ["a"])
})

test("Logical expressions", () => {
    expectIdentifierAssignmentTargets("a && 1", [], ["a"])
    expectIdentifierAssignmentTargets("a || 1", [], ["a"])
    expectIdentifierAssignmentTargets("a ?? 1", [], ["a"])
})

test("Edge: for-in expression initializer and destructuring property name", () => {
    expectIdentifierAssignmentTargets("for (a in obj) {}", ["a"])
    expectIdentifierAssignmentTargets("({ a: b } = obj)", ["b"], ["a"])
})
