import { expect, test } from "vitest"
import { isLeftValue } from "../../../../../src/compiler/ts-ast/assert"
import { parseExpression } from "../../../../../src/compiler/parser/script"

function expectIsLeftValue(source: string) {
    const node: any = parseExpression(source, 0)
    return expect(isLeftValue(node), `source: "${source}"`)
}

test("basic identifiers and type wrappers", () => {
    expectIsLeftValue("a").toBeTruthy()
    expectIsLeftValue("foo as any").toBeTruthy()
})

test("access chain", () => {
    expectIsLeftValue("a.b").toBeTruthy()
    expectIsLeftValue("a[0]").toBeTruthy()
    expectIsLeftValue("a['b']").toBeTruthy()
    expectIsLeftValue("a!.b!").toBeTruthy()
    expectIsLeftValue("a.b as any").toBeTruthy()
    expectIsLeftValue("a[foo as any]").toBeTruthy()
    expectIsLeftValue("a.b.c").toBeTruthy()
    expectIsLeftValue("a[0].b").toBeTruthy()
    expectIsLeftValue("a.b[0]").toBeTruthy()
    expectIsLeftValue("a[foo as any].bar").toBeTruthy()
    expectIsLeftValue("foo!.bar!").toBeTruthy()
})

test("destructuring and invalid expressions", () => {
    expectIsLeftValue("[a]").toBeFalsy()
    expectIsLeftValue("{ a }").toBeFalsy()
    expectIsLeftValue("(a)").toBeFalsy()
    expectIsLeftValue("(a.b)").toBeFalsy()
    expectIsLeftValue("a?.[b]").toBeFalsy()
    expectIsLeftValue("a?.b.c").toBeFalsy()
    expectIsLeftValue("a.b?.c").toBeFalsy()
    expectIsLeftValue("a?.[b].c").toBeFalsy()
    expectIsLeftValue("(a?.b).c").toBeFalsy()
    expectIsLeftValue("undefined as any").toBeFalsy()
    expectIsLeftValue("[a, [b = c, [d = e] = f, ...g] = h, ...i]").toBeFalsy()
    expectIsLeftValue("{ a, b: c, d: e = f, g: { h = i } = j, ...k }").toBeFalsy()
})

test("invalid call and update expressions", () => {
    expectIsLeftValue("a()").toBeFalsy()
    expectIsLeftValue("a++").toBeFalsy()
    expectIsLeftValue("a?.b").toBeFalsy()
    expectIsLeftValue("a += 1").toBeFalsy()
})

test("invalid operators and unary expressions", () => {
    expectIsLeftValue("a & b").toBeFalsy()
    expectIsLeftValue("a + b").toBeFalsy()
    expectIsLeftValue("a ? b : c").toBeFalsy()
    expectIsLeftValue("void(a)").toBeFalsy()
})

test("invalid literals and declarations", () => {
    expectIsLeftValue("undefined").toBeFalsy()
    expectIsLeftValue("null").toBeFalsy()
    expectIsLeftValue("()=>{}").toBeFalsy()
    expectIsLeftValue("''").toBeFalsy()
    expectIsLeftValue("1").toBeFalsy()
    expectIsLeftValue("class a{}").toBeFalsy()
    expectIsLeftValue("function(){}").toBeFalsy()
    expectIsLeftValue("function a(){}").toBeFalsy()
})
