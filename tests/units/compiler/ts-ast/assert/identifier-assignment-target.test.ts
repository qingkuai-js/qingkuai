import { expect, test } from "vitest"
import { findIdentifier, parseTsScript } from "../../../../../src/util/testing/ts-ast"
import { isIdentifierAssignmentTarget } from "../../../../../src/compiler/ts-ast/assert"

// 统一测试方法：同一输入中批量断言“是目标”和“非目标”标识符
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

// 基础赋值操作符
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

// 更新表达式（前缀和后缀 ++ 和 --）
test("Update expressions", () => {
    expectIdentifierAssignmentTargets("a++")
    expectIdentifierAssignmentTargets("++a")
    expectIdentifierAssignmentTargets("a--")
    expectIdentifierAssignmentTargets("--a")
})

// for-in/for-of initializer
test("For-in and for-of initializers", () => {
    expectIdentifierAssignmentTargets("for (let a in obj) {}", [], ["a"])
    expectIdentifierAssignmentTargets("for (const a of arr) {}", [], ["a"])
    expectIdentifierAssignmentTargets("for (var a in obj) {}", [], ["a"])
})

// 解构赋值 - 数组中的标识符
test("Destructuring array assignment", () => {
    expectIdentifierAssignmentTargets("[a, b] = [1, 2]", ["a", "b"])
    expectIdentifierAssignmentTargets("[a, ...b] = [1, 2, 3]", ["a", "b"])
})

// 解构赋值 - 对象中的标识符
test("Destructuring object assignment", () => {
    expectIdentifierAssignmentTargets("({a, b} = {a: 1, b: 2})", ["a", "b"])
    expectIdentifierAssignmentTargets("({a: x, b: y} = {a: 1, b: 2})", ["x", "y"])
})

// 嵌套解构赋值
test("Nested destructuring assignment", () => {
    expectIdentifierAssignmentTargets("([a, [b, c]] = [1, [2, 3]])", ["a", "b", "c"])
    expectIdentifierAssignmentTargets("({x: {a, b}} = {x: {a: 1, b: 2}})", ["a", "b"])
})

// 类型操作与赋值表达式混合
test("Type operations with assignment", () => {
    expectIdentifierAssignmentTargets("(a as number) = 1")
    expectIdentifierAssignmentTargets("(a satisfies number) = 1")
    expectIdentifierAssignmentTargets("((<number>a)) = 1")
    expectIdentifierAssignmentTargets("(a!) = 1")
    expectIdentifierAssignmentTargets("((a as number)!) = 1")
    expectIdentifierAssignmentTargets("((<number>a) satisfies number) = 1")
})

// 类型操作与更新表达式混合
test("Type operations with update expressions", () => {
    expectIdentifierAssignmentTargets("++(a as number)")
    expectIdentifierAssignmentTargets("--(a satisfies number)")
    expectIdentifierAssignmentTargets("++(<number>a)")
    expectIdentifierAssignmentTargets("--(a!)")
    expectIdentifierAssignmentTargets("++((a as number)!)")
    expectIdentifierAssignmentTargets("--((<number>a) satisfies number)")
})

// 括号表达式与赋值
test("Parenthesized expressions with assignment", () => {
    expectIdentifierAssignmentTargets("(a) = 1")
    expectIdentifierAssignmentTargets("((a)) = 1")
    expectIdentifierAssignmentTargets("(((a))) = 1")
    expectIdentifierAssignmentTargets("(a) += 1")
    expectIdentifierAssignmentTargets("((a)) -= 1")
})

// 括号表达式与更新表达式
test("Parenthesized expressions with update", () => {
    expectIdentifierAssignmentTargets("(a++)")
    expectIdentifierAssignmentTargets("((++a))")
    expectIdentifierAssignmentTargets("((a--))")
    expectIdentifierAssignmentTargets("(--a)")
})

// 括号表达式与解构赋值
test("Parenthesized expressions with destructuring", () => {
    expectIdentifierAssignmentTargets("([a, b]) = [1, 2]", ["a", "b"])
    expectIdentifierAssignmentTargets("(({x, y}) = {x: 1, y: 2})", ["x", "y"])
})

// 混合型操作：括号 + 类型操作 + 赋值
test("Combined type operations, parentheses and assignment", () => {
    expectIdentifierAssignmentTargets("((a as number)) = 1")
    expectIdentifierAssignmentTargets("(((a satisfies number))) = 1")
    expectIdentifierAssignmentTargets("(((<number>a))) = 1")
    expectIdentifierAssignmentTargets("((a!)) = 1")
    expectIdentifierAssignmentTargets("(((a as number)!)) = 1")
})

// 混合型操作：括号 + 类型操作 + 更新
test("Combined type operations, parentheses and update", () => {
    expectIdentifierAssignmentTargets("++(((a as number)))")
    expectIdentifierAssignmentTargets("--(((a satisfies number)))")
    expectIdentifierAssignmentTargets("++(((<number>a)))")
    expectIdentifierAssignmentTargets("--(((a!)))")
    expectIdentifierAssignmentTargets("++((((a as number)!)))")
})

// 赋值表达式右侧的标识符不应被认为是目标
test("Assignment right-hand side identifiers are not targets", () => {
    expectIdentifierAssignmentTargets("a = 1", ["a"])
    expectIdentifierAssignmentTargets("a + 1", [], ["a"])
    expectIdentifierAssignmentTargets("a = b", ["a"], ["b"])
    expectIdentifierAssignmentTargets("[x] = [a]", ["x"], ["a"])
})

// 普通二元表达式中的标识符
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

// 比较表达式中的标识符
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

// 逻辑表达式中的标识符
test("Logical expressions", () => {
    expectIdentifierAssignmentTargets("a && 1", [], ["a"])
    expectIdentifierAssignmentTargets("a || 1", [], ["a"])
    expectIdentifierAssignmentTargets("a ?? 1", [], ["a"])
})
