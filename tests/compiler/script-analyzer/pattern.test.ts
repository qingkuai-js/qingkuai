import type { PatternLike } from "@babel/types"
import type { EstreeWalkContext } from "#type-declarations/compiler"

import { expect, test } from "vitest"
import { NOOP } from "../../../src/runtime/constants"
import { parse, parseExpression } from "@babel/parser"
import { isLeftValue } from "../../../src/compiler/estree/assert"
import { walkEstree, walkPatternIdentifiers } from "../../../src/compiler/estree/walk"

function extractIdentifiers(source: string) {
    const result: string[][] = []

    const extract = (node: PatternLike, context: EstreeWalkContext<PatternLike>) => {
        switch (context.striptTypeOperationsParent?.value.type) {
            case "ObjectMethod":
            case "CatchClause":
            case "ForStatement":
            case "ForInStatement":
            case "ForOfStatement":
            case "ClassMethod":
            case "ClassPrivateMethod":
            case "TSParameterProperty":
            case "VariableDeclarator":
            case "AssignmentExpression":
            case "FunctionExpression":
            case "FunctionDeclaration":
            case "ArrowFunctionExpression": {
                walkPatternIdentifiers(node, ({ name }, path) => {
                    result.push([name, path])
                })
            }
        }
    }

    walkEstree(
        parse(source, {
            sourceType: "module",
            plugins: ["typescript"]
        }),
        {
            ArrayPattern: extract,
            ObjectPattern: extract,
            AssignmentPattern: extract
        }
    )
    return result
}

test("Left value", () => {
    function expectIsLeftValue(source: string, expected: boolean, key?: string) {
        const node: any = parseExpression(source, {
            plugins: ["typescript"]
        })
        expect(isLeftValue(key ? node[key] : node), `source: "${source}"`).toBe(expected)
    }

    expectIsLeftValue("a", true)
    expectIsLeftValue("a.b", true)
    expectIsLeftValue("a!.b!", true)

    expectIsLeftValue("[a] = _", false, "left")
    expectIsLeftValue("{ a } = _", false, "left")
    expectIsLeftValue("[a, [b = c, [d = e] = f, ...g] = h, ...i] = _", false, "left")
    expectIsLeftValue("{ a, b: c, d: e = f, g: { h = i } = j, ...k } = _", false, "left")

    for (const expression of [
        "a()",
        "a++",
        "a?.b",
        "a & b",
        "a + b",
        "a += 1",
        "a ? b : c",
        "void(a)",
        "undefined",
        "null",
        "()=>{}",
        "''",
        "1",
        "class a{}",
        "function(){}",
        "function a(){}"
    ]) {
        expectIsLeftValue(expression, false)
    }
})

test("Whether default value is specified", () => {
    function expectedDefaultValueIsSpecified(source: string, expected: boolean) {
        const node: any = parseExpression(`${source} = _`, {
            plugins: ["typescript"]
        })
        expect(walkPatternIdentifiers(node.left, NOOP).specifiedDefaultValue).toBe(expected)
    }

    expectedDefaultValueIsSpecified("{ a }", false)
    expectedDefaultValueIsSpecified("{ a, b }", false)
    expectedDefaultValueIsSpecified("{ a, b: { c }, ...d }", false)
    expectedDefaultValueIsSpecified("[a, [b, [c, [d]]], ...e]", false)

    expectedDefaultValueIsSpecified("[a = b]", true)
    expectedDefaultValueIsSpecified("{ a = b }", true)
    expectedDefaultValueIsSpecified("[a, [b = c]]", true)
    expectedDefaultValueIsSpecified("{ a, b = c }", true)
    expectedDefaultValueIsSpecified("[a, [b, [c, [d = e]]]]", true)
    expectedDefaultValueIsSpecified("{ a, b: { c: { d = e } } }", true)
    expectedDefaultValueIsSpecified("[a, [b, [c, [d]]] = e, ...f]", true)
    expectedDefaultValueIsSpecified("{ a: { b: { c } } = d, ...e}", true)
})

test("Variable declarations", () => {
    const identifiers = extractIdentifiers(`
        var {a, b, c = d, e} = {}
        let [f, g, h = i, j] = []

        const {
            k: l,
            m: { n },
            o: {
                p: {
                    q = r
                } = s
            } = t,
            u
        }: any = {}

        const [v, [w, [x, [y = z] = A] = B] = C, D] = []
    `)
    expect(identifiers).toEqual([
        ["a", ".a"],
        ["b", ".b"],
        ["c", ".c"],
        ["e", ".e"],
        ["f", "[0]"],
        ["g", "[1]"],
        ["h", "[2]"],
        ["j", "[3]"],
        ["l", ".k"],
        ["n", ".m.n"],
        ["q", ".o.p.q"],
        ["u", ".u"],
        ["v", "[0]"],
        ["w", "[1][0]"],
        ["x", "[1][1][0]"],
        ["y", "[1][1][1][0]"],
        ["D", "[2]"]
    ])
})

test("Function parameters", () => {
    const identifiers = extractIdentifiers(`
        function _({
            a: b = c,
            d: {
                e = f
            },
            g
        }){}

        ;(([h = i, [j = k] = l, m])=>{})()

        _ = {
            _({
                n: o = p,
                q
            }){}
        }

        class __{
            constructor(public r, private s = t){}

            _([u = v, [w = x] = y, z]){}

            #_({
                A: {
                    B = C,
                    D
                },
                E
            }){}
        }
    `)
    expect(identifiers).toEqual([
        ["b", ".a"],
        ["e", ".d.e"],
        ["g", ".g"],
        ["h", "[0]"],
        ["j", "[1][0]"],
        ["m", "[2]"],
        ["o", ".n"],
        ["q", ".q"],
        ["s", ""],
        ["u", "[0]"],
        ["w", "[1][0]"],
        ["z", "[2]"],
        ["B", ".A.B"],
        ["D", ".A.D"],
        ["E", ".E"]
    ])
})

test("Assignment expressions", () => {
    const identifiers = extractIdentifiers(`
        ;[a = b, [c = d] = e, [f = g, [h = i] = j]] = []
        ;({
            k,
            l: {
                m: n = o
            } = p,
            q
        } = {})
    `)
    expect(identifiers).toEqual([
        ["a", "[0]"],
        ["c", "[1][0]"],
        ["f", "[2][0]"],
        ["h", "[2][1][0]"],
        ["k", ".k"],
        ["n", ".l.m"],
        ["q", ".q"]
    ])
})

test("Statements", () => {
    const identifiers = extractIdentifiers(`
        try{}catch({
            a,
            b: c = d,
            e: {
                f: g = h
            },
            i
        }){}

        for([j, [k = l], [m = n, [o = p] = q]] in []){}

        for({
            r,
            s: t = u,
            v: v = w,
            x
        } of {}){}
    `)
    expect(identifiers).toEqual([
        ["a", ".a"],
        ["c", ".b"],
        ["g", ".e.f"],
        ["i", ".i"],
        ["j", "[0]"],
        ["k", "[1][0]"],
        ["m", "[2][0]"],
        ["o", "[2][1][0]"],
        ["r", ".r"],
        ["t", ".s"],
        ["v", ".v"],
        ["x", ".x"]
    ])
})
