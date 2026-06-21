import ts from "typescript"

import { expect, test } from "vitest"
import { NOOP } from "../../../../../src/runtime/constants"
import { walkTsNode } from "../../../../../src/compiler/ts-ast/walk"
import { findFirstAncestorUntil } from "../../../../../src/compiler/ts-ast/sundry"
import { walkBindingNameIdentifiers } from "../../../../../src/compiler/ts-ast/walk"
import { parseScript, parseContextPattern } from "../../../../../src/compiler/parser/script"

function extractIdentifiers(source: string) {
    const result: string[][] = []
    const existingIdentifiers = new Set<string>()
    walkTsNode(parseScript(source), node => {
        if (!ts.isBindingName(node) || findFirstAncestorUntil(node, ts.isBindingName)) {
            return
        }

        if (ts.isIdentifier(node)) {
            const parentNode = node.parent
            const isSupportedIdentifierPattern =
                (ts.isBindingElement(parentNode) && parentNode.name === node) ||
                (ts.isVariableDeclaration(parentNode) && parentNode.name === node) ||
                (ts.isParameter(parentNode) && parentNode.name === node && !!parentNode.initializer)
            if (!isSupportedIdentifierPattern) {
                return
            }
        }

        walkBindingNameIdentifiers(node, (id, path) => {
            if (!existingIdentifiers.has(id.text)) {
                existingIdentifiers.add(id.text)
                result.push([id.text, path])
            }
        })
    })
    return result
}

test("Whether default value is specified", () => {
    function expectedDefaultValueIsSpecified(source: string, expected: boolean) {
        const pattern: ts.ArrayBindingPattern = parseContextPattern(source, 0)!
        expect(
            walkBindingNameIdentifiers(pattern, NOOP).specifiedDefaultValue,
            `source: ${source}`
        ).toBe(expected)
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
