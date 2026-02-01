import fs from "node:fs"
import path from "node:path"

import {
    camel2Kebab,
    kebab2Camel,
    findEndBracket,
    findOutOfLiteral,
    findOutOfComment,
    findOutOfLiteralComment
} from "../../src/util/compiler/string"
import { expect, test } from "vitest"
import { getPositionOfEachChar } from "../../src/util/compiler/position"

test("Function: getPositionOfEachChar", () => {
    expect(getPositionOfEachChar("abc")).toMatchObject([
        { line: 1, column: 0, index: 0 },
        { line: 1, column: 1, index: 1 },
        { line: 1, column: 2, index: 2 },
        { line: 1, column: 3, index: 3 }
    ])

    expect(getPositionOfEachChar("a\nb")).toMatchObject([
        { line: 1, column: 0, index: 0 },
        { line: 1, column: 1, index: 1 },
        { line: 2, column: 0, index: 2 },
        { line: 2, column: 1, index: 3 }
    ])

    expect(getPositionOfEachChar("x\ny\nz")).toMatchObject([
        { line: 1, column: 0, index: 0 },
        { line: 1, column: 1, index: 1 },
        { line: 2, column: 0, index: 2 },
        { line: 2, column: 1, index: 3 },
        { line: 3, column: 0, index: 4 },
        { line: 3, column: 1, index: 5 }
    ])

    expect(getPositionOfEachChar(" a\n\nb")).toMatchObject([
        { line: 1, column: 0, index: 0 },
        { line: 1, column: 1, index: 1 },
        { line: 1, column: 2, index: 2 },
        { line: 2, column: 0, index: 3 },
        { line: 3, column: 0, index: 4 },
        { line: 3, column: 1, index: 5 }
    ])

    expect(getPositionOfEachChar("a\x01b")).toMatchObject([
        { line: 1, column: 0, index: 0 },
        { line: 1, column: 1, index: 1 },
        { line: 1, column: 2, index: 2 },
        { line: 1, column: 3, index: 3 }
    ])

    expect(getPositionOfEachChar("hi🧠𠮷")).toMatchObject([
        { line: 1, column: 0, index: 0 },
        { line: 1, column: 1, index: 1 },
        { line: 1, column: 2, index: 2 },
        { line: 1, column: 3, index: 3 },
        { line: 1, column: 4, index: 4 },
        { line: 1, column: 5, index: 5 },
        { line: 1, column: 6, index: 6 }
    ])

    expect(getPositionOfEachChar("a\tb\nc你🧠\n𠮷")).toMatchObject([
        { line: 1, column: 0, index: 0 },
        { line: 1, column: 1, index: 1 },
        { line: 1, column: 2, index: 2 },
        { line: 1, column: 3, index: 3 },
        { line: 2, column: 0, index: 4 },
        { line: 2, column: 1, index: 5 },
        { line: 2, column: 2, index: 6 },
        { line: 2, column: 3, index: 7 },
        { line: 2, column: 4, index: 8 },
        { line: 3, column: 0, index: 9 },
        { line: 3, column: 1, index: 10 },
        { line: 3, column: 2, index: 11 }
    ])

    expect(getPositionOfEachChar("")).toMatchObject([{ line: 1, column: 0, index: 0 }])
})

test("Function: camel2Kebab", () => {
    expect(camel2Kebab("ab")).toBe("ab")
    expect(camel2Kebab("aB")).toBe("a-b")
    expect(camel2Kebab("AB")).toBe("a-b")
    expect(camel2Kebab("ABC")).toBe("a-b-c")
    expect(camel2Kebab("a-b-c")).toBe("a-b-c")

    expect(camel2Kebab("A")).toBe("a")
    expect(camel2Kebab("A", false)).toBe("A")
    expect(camel2Kebab("A-b-c")).toBe("a-b-c")
    expect(camel2Kebab("A-b-c", false)).toBe("A-b-c")
})

test("Function: kebab2Camel", () => {
    expect(kebab2Camel("a")).toBe("a")
    expect(kebab2Camel("a-b")).toBe("aB")
    expect(kebab2Camel("a-b-c")).toBe("aBC")
    expect(kebab2Camel("a--b-c")).toBe("aBC")
    expect(kebab2Camel("a--b--c")).toBe("aBC")
    expect(kebab2Camel("a--b--c-")).toBe("aBC")

    expect(kebab2Camel("a", true)).toBe("A")
    expect(kebab2Camel("a-b", true)).toBe("AB")
    expect(kebab2Camel("a-b-c", true)).toBe("ABC")
    expect(kebab2Camel("a--b-c", true)).toBe("ABC")
    expect(kebab2Camel("a--b--c", true)).toBe("ABC")
    expect(kebab2Camel("a--b--c-", true)).toBe("ABC")
})

test("Function: findEndBracket", () => {
    expect(findEndBracket("{a +")).toBe(-1)
    expect(findEndBracket("[1, 2")).toBe(-1)
    expect(() => findEndBracket("a + b")).toThrow()

    expect(findEndBracket("{}")).toBe(1)
    expect(findEndBracket("()")).toBe(1)
    expect(findEndBracket("[]")).toBe(1)
    expect(findEndBracket("{ }")).toBe(2)
    expect(findEndBracket("{a + b}")).toBe(6)
    expect(findEndBracket("(x + y)")).toBe(6)
    expect(findEndBracket("[1, 2, 3]")).toBe(8)

    expect(findEndBracket("((a + b))")).toBe(8)
    expect(findEndBracket("[[1, 2, 3]]")).toBe(10)
    expect(findEndBracket("{a + (b * c)}")).toBe(12)
    expect(findEndBracket("[(1 + 2) * 3]")).toBe(12)
    expect(findEndBracket("({a: [1, 2]})")).toBe(12)
    expect(findEndBracket("{a: { b: 1 }}")).toBe(12)
    expect(findEndBracket("{ a: 1, b: 2 }")).toBe(13)
    expect(findEndBracket("{bool ? a : b}")).toBe(13)
    expect(findEndBracket("[1, [2, 3], 4]")).toBe(13)
    expect(findEndBracket("{a + b} other content...")).toBe(6)
    expect(findEndBracket("(bar(baz({a: {b: 1}})))")).toBe(22)
    expect(findEndBracket("{ a: { xxx }, b: { c: {} } }")).toBe(27)
    expect(findEndBracket("{ [1, 2, {a: () => (1 + 2)}] };")).toBe(29)

    expect(findEndBracket("(`${ ) }`)")).toBe(5)
    expect(findEndBracket("{`${ } }`}")).toBe(9)
    expect(findEndBracket(`{ [a, b, "}"] }`)).toBe(14)
    expect(findEndBracket(`["]", "]", "]"]`)).toBe(14)
    expect(findEndBracket("{ a + /* } */ b }")).toBe(16)
    expect(findEndBracket("{a /** } */ + b /*}*/ + c /* } */}")).toBe(33)
})

test("Function: findOutOfComment", () => {
    expect(findOutOfComment("//test", "test")).toBe(-1)
    expect(findOutOfComment(`/* test */`, "test")).toBe(-1)
    expect(findOutOfComment(`/* unterminated test`, "test")).toBe(-1)

    expect(findOutOfComment(`/* test */ test`, "test")).toBe(11)
    expect(findOutOfComment(`// test\nabc test`, "test")).toBe(12)
    expect(findOutOfComment(`/* test */ // test\ntest test`, "test")).toBe(19)
    expect(findOutOfComment(`/* test */ // skip\nlet x = test`, "test")).toBe(27)
    expect(findOutOfComment(`/* test */ // another test\ntest`, "test")).toBe(27)

    // 使用正则表达式查找
    // Use regular expression to search
    expect(findOutOfComment(`// test\ntest`, /test/)).toEqual([8, 4])
    expect(findOutOfComment(`/* comment */ const test = 1`, /test/)).toEqual([20, 4])

    // 偏移 startIndex
    // Offset by startIndex
    expect(findOutOfComment(`test test // test`, "test", 6)).toBe(-1)
    expect(findOutOfComment(`test // test\ntest`, /test/, 10)).toEqual([13, 4])
})

test("Function: findOutOfLiteral", () => {
    expect(findOutOfLiteral(`'test`, "test")).toBe(-1)
    expect(findOutOfLiteral(`"test`, "test")).toBe(-1)
    expect(findOutOfLiteral(`"test"`, "test")).toBe(-1)
    expect(findOutOfLiteral(`"\n"test`, "test")).toBe(-1)
    expect(findOutOfLiteral(`'\n'test`, "test")).toBe(-1)

    expect(findOutOfLiteral(`/test/`, "test")).toBe(-1)
    expect(findOutOfLiteral(`/\ntest/`, "test")).toBe(-1)
    expect(findOutOfLiteral(`/\\/test/`, "test")).toBe(-1)
    expect(findOutOfLiteral(`a ? /[test]/ : /""test/`, "test")).toBe(-1)

    expect(findOutOfLiteral("`\n`test", "test")).toBe(3)
    expect(findOutOfLiteral(`"test" test 'test'`, "test")).toBe(7)
    expect(findOutOfLiteral(`"abc test def" test`, "test")).toBe(15)
    expect(findOutOfLiteral(`'hello "test"' test`, "test")).toBe(15)
    expect(findOutOfLiteral(`"a test" 'b test' test`, "test")).toBe(18)

    expect(findOutOfLiteral(`/abc/ + test`, "test")).toBe(8)
    expect(findOutOfLiteral(`/['"\`]/.test`, "test")).toBe(8)
    expect(findOutOfLiteral(`/test/.test(test)`, "test")).toBe(7)

    // 带转义字符的字符串
    // String with escape characters
    expect(findOutOfLiteral(`'escaped \\'test\\'' test`, "test")).toBe(19)
    expect(findOutOfLiteral(`"escaped \\"test\\"" test`, "test")).toBe(19)
    expect(findOutOfLiteral(`'line \\\n continuation' test`, "test")).toBe(23)

    // 模板字符串
    // Template string
    expect(findOutOfLiteral("`x${1 + test + 2}`", "test")).toBe(8)
    expect(findOutOfLiteral("`a ${'b test'} c` test", "test")).toBe(18)
    expect(findOutOfLiteral("`a${`b${`c test`}d`}e` test", "test")).toBe(23)
    expect(findOutOfLiteral("`a${`b${`c ${test}`}d`}e` test", "test")).toBe(13)
    expect(findOutOfLiteral("`hello ${`inner ${'test'}`} test` test", "test")).toBe(34)

    // 偏移 startIndex
    // Offset by startIndex
    expect(findOutOfLiteral(`'test' test test`, "test", 13)).toBe(-1)
    expect(findOutOfLiteral(`"test" test test`, "test", 10)).toBe(12)

    // 使用正则表达式查找
    // Use regular expression to search
    expect(findOutOfLiteral(`"test" test test`, /test/)).toEqual([7, 4])
    expect(findOutOfLiteral(`'escaped \\'test\\'' test`, /test/)).toEqual([19, 4])
    expect(findOutOfLiteral("`hello ${`inner ${'test'}`} test` test", /test/)).toEqual([34, 4])
})

test("Function: findOutOfLiteralComment", () => {
    expect(findOutOfLiteralComment(`"unclosed test`, "test")).toBe(-1)
    expect(findOutOfLiteralComment(`/* unclosed test`, "test")).toBe(-1)
    expect(findOutOfLiteralComment(`// comment without newline test`, "test")).toBe(-1)
    expect(findOutOfLiteralComment(`"test" /* test */ // test\n'test'`, "test")).toBe(-1)

    expect(findOutOfLiteralComment("`a ${'test'} b` test", "test")).toBe(16)
    expect(findOutOfLiteralComment(`'test' // test\n test`, "test")).toBe(16)
    expect(findOutOfLiteralComment(`"test" /* test */ test`, "test")).toBe(18)
    expect(findOutOfLiteralComment("`a ${/* test */ 1 + 2} b` test", "test")).toBe(26)
    expect(findOutOfLiteralComment("`a ${'test' /* test */ + test}`", "test")).toBe(25)
    expect(findOutOfLiteralComment("`a ${'b test'} c` // test\n test", "test")).toBe(27)
    expect(findOutOfLiteralComment(`'a test' /* block */ // line\n test`, "test")).toBe(30)
    expect(findOutOfLiteralComment(`"test" /* test */ 'test' // test\ntest`, "test")).toBe(33)
    expect(findOutOfLiteralComment(`test /* comment */ test // comment\ntest`, "test", 20)).toBe(35)

    expect(findOutOfLiteralComment(`'test' // test\ntest`, /test/)).toEqual([15, 4])
    expect(findOutOfLiteralComment("`x${'test'} y` test`, test", /test/)).toEqual([15, 4])
    expect(findOutOfLiteralComment(`let a = 1; // comment\ntest`, /test/)).toEqual([22, 4])

    // 复杂文件测试
    // Complex file testing.
    for (const fileName of ["chunks/runtime.js", "runtime/index.js", "runtime/internal.js"]) {
        const fullPath = path.resolve(import.meta.dirname, "../../dist", fileName)
        if (!fs.existsSync(fullPath)) {
            continue
        }

        const target = "_".repeat(100)
        const content = fs.readFileSync(fullPath, "utf-8")
        expect(findOutOfLiteralComment(content + target, target)).toBe(content.length)
    }
})
