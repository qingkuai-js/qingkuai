import type { ArrayPattern, AssignmentPattern, ObjectPattern } from "@babel/types"

import { expect, test } from "vitest"
import { parse } from "@babel/parser"
import { arrayFrom } from "../../../src/util/shared/arrays"
import { walk, walkDeclarationIdentifiers } from "../../../src/util/compiler/estree/walk"

function extractIdentifiers(source: string) {
    const result = new Set<string>()
    walk(
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
    return arrayFrom(result)

    function extract(node: ArrayPattern | ObjectPattern | AssignmentPattern) {
        walkDeclarationIdentifiers(node, ({ name }) => {
            result.add(name)
        })
    }
}

test("Variable declarations", () => {
    const identifiers = extractIdentifiers(`
        var {a, b, c = d, ...e} = {}
        let [f, g, h = i, ...j] = []

        const {
            k: l,
            m: { n },
            o: {
                p: {
                    q = r
                } = s
            } = t,
            ...u
        }: any = {}
        
        const [v, [w, [x, [y = z] = A] = B] = C, ...D] = []
    `)
    expect(identifiers).toEqual([
        "a",
        "b",
        "c",
        "e",
        "f",
        "g",
        "h",
        "j",
        "l",
        "n",
        "q",
        "u",
        "v",
        "w",
        "x",
        "y",
        "D"
    ])
})

test("Function parameters", () => {
    const identifiers = extractIdentifiers(`
        function _({
            a: b = c,
            d: {
                e = f
            },
            ...g
        }){}

        ;(([h = i, [j = k] = l, ...m])=>{})()

        _ = {
            _({
                n: o = p,
                ...q
            }){}
        }

        class __{
            constructor(public r, private s = t){}

            _([u = v, [w = x] = y, ...z]){}

            #_({
                A: { B = C },
                ...D
            }){}
        }
    `)
    expect(identifiers).toEqual([
        "b",
        "e",
        "g",
        "h",
        "j",
        "m",
        "o",
        "q",
        "s",
        "u",
        "w",
        "z",
        "B",
        "D"
    ])
})

test("Assignment expressions", () => {
    const identifiers = extractIdentifiers(`
        ;[a = b, [c = d] = e, ...[f = g, [h = i] = j]] = []
        ;({
            k,
            l: {
                n: n = o
            } = p,
            ...q
        } = {})
    `)
    expect(identifiers).toEqual(["a", "c", "f", "h", "k", "n", "q"])
})

test("Statements", () => {
    const identifiers = extractIdentifiers(`
        try{}catch({
            a,
            b: c = d,
            e: {
                f: g = h
            },
            ...i
        }){}

        for([j, [k = l], ...[m = n, [o = p] = q]] in []){}

        for({r, s: t = u, ...v} of {}){}
    `)
    expect(identifiers).toEqual(["a", "c", "g", "i", "j", "k", "m", "o", "r", "t", "v"])
})
