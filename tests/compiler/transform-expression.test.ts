import { test, expect, it } from "vitest"
import { analyzeScript } from "../../compiler/analyzer/script"
import { transformExpression } from "../../compiler/transformer/expression"
import { TemplateContext } from "../../compiler/types"

const emptyContext: TemplateContext = {
    count: 0,
    map: new Map()
}
const normalContext: TemplateContext = {
    count: 1,
    map: new Map([
        [
            "res",
            {
                to: "ctx(0)"
            }
        ]
    ])
}

// 提前模拟分析script源码：用来标记一些响应式变量
analyzeScript(`let a; const ca = rea(""); let sa = stc("")`)

test("without context", () => {
    const inputExpectPair = [
        ["a", "_ => a.$"],
        ["a.a", "_ => a.$.a"],
        ["a['a']", "_ => a.$['a']"],
        ["a?.a", "_ => a.$?.a"],
        ["a?.[0]", "_ => a.$?.[0]"],
        ["ca", "_ => ca"],
        ["ca.a", "_ => ca.a"],
        ["ca['a']", "_ => ca['a']"],
        ["ca?.a", "_ => ca?.a"],
        ["ca?.[0]", "_ => ca?.[0]"],
        ["sa", "_ => sa"],
        ["sa.a", "_ => sa.a"],
        ["sa?.a", "_ => sa?.a"],
        ["sa?.[a]", "_ => sa?.[a.$]"],
        ["a + ca", "_ => a.$ + ca"],
        ["ca + sa", "ca + sa"],
        ["ca + a + sa", "_ => ca + a.$ + sa"]
    ]
    inputExpectPair.forEach(([inp, exp]) => {
        expect(transformExpression(inp, emptyContext)).toBe(exp)
    })
})

test("with context", () => {
    const inputExpectPair = [
        ["a", "_ => a.$"],
        ["ca", "_ => ca"],
        ["sa", "_ => sa"],
        ["res", "ctx => ctx(0)"],
        ["a + res", "ctx => a.$ + ctx(0)"],
        ["res + ca", "ctx => ctx(0) + ca"],
        ["sa[res][a]?.[ca]", "ctx => sa[ctx(0)][a.$]?.[ca]"]
    ]
    inputExpectPair.forEach(([inp, exp]) => {
        expect(transformExpression(inp, normalContext)).toBe(exp)
    })
})

test("whether return value is parenthesized when it starts with {", () => {
    const inputExpectPair = [
        ["{}", "{}"],
        ["[][ca]", "_ => [][ca]"],
        ["{}[a]", "_ => ({}[a.$])"],
        ["{} + ca.a", "{} + ca.a"],
        ["{}?.[res]?.[a][ca]", "ctx => ({}?.[ctx(0)]?.[a.$][ca])"]
    ]
    inputExpectPair.forEach(([inp, exp]) => {
        expect(transformExpression(inp, normalContext)).toBe(exp)
    })
})

it("expects the result without getter wrapper", () => {
    const inputExpectPair = [
        ["1", "1"],
        ["'123'", "'123'"],
        ["`123`", "`123`"],
        ["{a:1}", "{a:1}"],
        ["[1,2]", "[1,2]"],
        ["+ca", "+ca"],
        ["ca++", "ca++"],
        ["ca + 1", "ca + 1"],
        ["sa+sa?.a", "sa+sa?.a"]
    ]
    inputExpectPair.forEach(([inp, exp]) => {
        expect(transformExpression(inp, emptyContext)).toBe(exp)
    })
})

it("expects the result never without getter(pass optionalParams.usedAsSetter)", () => {
    const inputExpectPair = [
        ["a", "a.$"],
        ["a.a", "a.$.a"],
        ["a['a']", "a.$['a']"],
        ["a?.a", "a.$?.a"],
        ["a?.[0]", "a.$?.[0]"],
        ["ca", "ca"],
        ["ca.a", "ca.a"],
        ["ca['a']", "ca['a']"],
        ["ca?.a", "ca?.a"],
        ["ca?.[0]", "ca?.[0]"],
        ["sa", "sa"],
        ["sa.a", "sa.a"],
        ["sa?.a", "sa?.a"],
        ["sa?.[a]", "sa?.[a.$]"],
        ["a + ca", "a.$ + ca"],
        ["ca + sa", "ca + sa"],
        ["ca + a + sa", "ca + a.$ + sa"]
    ]
    inputExpectPair.forEach(([inp, exp]) => {
        expect(
            transformExpression(inp, emptyContext, {
                usedAsSetter: true
            })
        ).toBe(exp)
    })
})

it("expects the result to be in event structure format(pass optional.eventWrapperFlag)", () => {
    let inputExpectPair = [
        ["1", "_ => event => 1"],
        ["''", "_ => event => ''"],
        ["a", "_ => a.$"],
        ["a.a", "_ => a.$.a"],
        ["a['a']", "_ => a.$['a']"],
        ["a?.a", "_ => a.$?.a"],
        ["a?.[0]", "_ => a.$?.[0]"],
        ["ca", "_ => ca"],
        ["a++", "_ => event => a.$++"],
        ["() => {}", "_ => () => {}"],
        ["a()", "ctx => event => ctx(a.$)()"],
        ["res()", "ctx => event => ctx(ctx(0))()"],
        ["a + res", "ctx => event => a.$ + ctx(0)"],
        ["(function a(){})()", "ctx => event => (ctx(function a(){}))()"]
    ]
    inputExpectPair.forEach(([inp, exp]) => {
        expect(
            transformExpression(inp, normalContext, {
                eventWrapperFlag: 0
            })
        ).toBe(exp)
    })

    inputExpectPair = [
        ["1", "_ => eventWrapper(event => 1, 1)"],
        ["''", "_ => eventWrapper(event => '', 1)"],
        ["a", "_ => eventWrapper(a.$, 1)"],
        ["a.a", "_ => eventWrapper(a.$.a, 1)"],
        ["a['a']", "_ => eventWrapper(a.$['a'], 1)"],
        ["a?.a", "_ => eventWrapper(a.$?.a, 1)"],
        ["a?.[0]", "_ => eventWrapper(a.$?.[0], 1)"],
        ["ca", "_ => eventWrapper(ca, 1)"],
        ["a++", "_ => eventWrapper(event => a.$++, 1)"],
        ["() => {}", "_ => eventWrapper(() => {}, 1)"],
        ["a()", "ctx => eventWrapper(event => ctx(a.$)(), 1)"],
        ["res()", "ctx => eventWrapper(event => ctx(ctx(0))(), 1)"],
        ["a + res", "ctx => eventWrapper(event => a.$ + ctx(0), 1)"],
        ["(function a(){})()", "ctx => eventWrapper(event => (ctx(function a(){}))(), 1)"]
    ]
    inputExpectPair.forEach(([inp, exp]) => {
        expect(
            transformExpression(inp, normalContext, {
                eventWrapperFlag: 1
            })
        ).toBe(exp)
    })
})
