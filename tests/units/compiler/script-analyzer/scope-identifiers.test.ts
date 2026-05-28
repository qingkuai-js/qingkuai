import ts from "typescript"

import { expect, test } from "vitest"
import { parseTsScript } from "../../../../src/util/testing/ts-ast"
import { walkTsNodeWithContext } from "../../../../src/compiler/ts-ast/walk"

function checkScopeIdentifiersByMatrix(source: string, full: string[][]) {
    const sourceFile = parseTsScript(source)
    walkTsNodeWithContext(sourceFile, node => {
        if (!ts.isIdentifier(node)) {
            return
        }

        const match = /^_mark(\d+)_$/.exec(node.text)
        if (!match) {
            return
        }

        const expected = full[parseInt(match[1], 10) - 1].sort()
        expect(Array.from(node.scopeIdentifiers ?? []).sort(), match[0]).toEqual(expected)
    })
}

test("Expression scopeIdentifiers in nested blocks", () => {
    const source = `
        if (condition) {
            _mark1_;
            let a;
            const b = 1;
            let { c, d: e, f: { g: h = i } } = {};

            var [j, [k]] = [];

            enum l {}
            enum l {}
            namespace m {
                _mark2_;
                var n;
                const o = 0;
                namespace p {
                    _mark3_;
                    var q;
                    let r;
                }
            }

            namespace s.t.u {
                // will not emit js
            }

            namespace v.w.x {
                _mark4_;
                const y = 0;
            }

            try {
                _mark5_;
                var v: any;
                let w: string;
            } catch (x: Error) {
                _mark6_;
            }
        }
    `

    checkScopeIdentifiersByMatrix(source, [
        ["a", "b", "c", "e", "h", "l", "m", "v"],
        ["a", "b", "c", "e", "h", "l", "m", "n", "o", "p", "v"],
        ["a", "b", "c", "e", "h", "l", "m", "n", "o", "p", "q", "r", "v"],
        ["a", "b", "c", "e", "h", "l", "m", "v", "y"],
        ["a", "b", "c", "e", "h", "l", "m", "v", "w"],
        ["a", "b", "c", "e", "h", "l", "m", "v", "x"]
    ])
})

test("Function scopes with generic parameters", () => {
    const source = `
        function a<t>(b: t, { b: c = d }, [e, [f]]) {
            _mark1_
            let g
            var { h: i } = {}

            ;(function j<u>(k: u, { l: m }) {
                _mark2_
                var n
            })

            const o = <v,>(p: v, [q]) => {
                _mark3_
                var s
                return {
                    r(t, { u: v }) {
                        var w
                        _mark4_
                    }
                }
            }

            enum x {}
            namespace y {
                _mark5_
                const z = 1
            }
        }
    `

    checkScopeIdentifiersByMatrix(source, [
        ["a", "b", "c", "e", "f", "g", "i", "o", "x", "y"],
        ["a", "b", "c", "e", "f", "g", "i", "j", "k", "m", "n", "o", "x", "y"],
        ["a", "b", "c", "e", "f", "g", "i", "o", "p", "q", "s", "x", "y"],
        ["a", "b", "c", "e", "f", "g", "i", "o", "p", "q", "s", "t", "v", "w", "x", "y"],
        ["a", "b", "c", "e", "f", "g", "i", "o", "x", "y", "z"]
    ])
})

test("Class scopes with generic parameters", () => {
    const source = `
        class a<t> {
            _mark1_ = 1
            b = 2

            c<u>(d: u, { e: f = g, h: { i } = j }) {
                _mark2_
            }
            #d([k, [l = m], [n] = o]) {
                _mark3_
                return class {
                    constructor<v>(public q: v, private r = s) {
                        _mark4_
                        var t
                    }
                    u<w>(v: w, w = x) {
                        _mark5_
                        let y
                        var { z, A: B = C, D: { E } = F } = {}
                    }
                    #G(H, I = J, { K: L = M }) {
                        _mark6_
                        var N
                        enum O {}
                    }
                }
            }
        }
    `

    checkScopeIdentifiersByMatrix(source, [
        ["a"],
        ["a", "d", "f", "i"],
        ["a", "k", "l", "n"],
        ["a", "k", "l", "n", "t"],
        ["a", "k", "l", "n", "v", "w", "y", "z", "B", "E"],
        ["a", "k", "l", "n", "H", "I", "L", "N", "O"]
    ])
})

test("For-statement scopes", () => {
    const source = `
        for (let a, { b, c: d = e, f: { g } } = {};;) {
            _mark1_
            const h = 0
            var i
            var [j, [k]] = []
        }

        for (var l, [m] = [];;) {
            _mark2_
            var n
        }

        for (const o of p) {
            _mark3_
        }

        for (var { q: r } of {}) {
            _mark4_
            var s
            let t
        }

        for (const u in []) {
            _mark5_
        }

        for (var v in {}) {
            _mark6_
        }

        for ({ w, x: y = z } of []) {
            _mark7_
        }
    `

    checkScopeIdentifiersByMatrix(source, [
        ["a", "b", "d", "g", "h"],
        [],
        ["o"],
        ["t"],
        ["u"],
        [],
        []
    ])
})

test("Arrow functions without block bodies", () => {
    const source = `
        {
            _mark1_
            const a = <t,>(b: t, c = d, ...e) => _mark2_
            ;<u,>({ f: g = h, i: [j, k = l] }: u) => _mark3_

            const m = <v,>([n, o = p, ...q]: v, ...r) => (_mark4_, <w,>(s: w = u, ...v) => _mark5_)
        }
    `

    checkScopeIdentifiersByMatrix(source, [
        ["a", "m"],
        ["a", "b", "c", "e", "m"],
        ["a", "g", "j", "k", "m"],
        ["a", "m", "n", "o", "q", "r"],
        ["a", "m", "n", "o", "q", "r", "s", "v"]
    ])
})

test("For-related no-block scopes remain stable", () => {
    const source = `
        for (let a, b; _mark1_; ) _mark2_;
        for (const { c, d: e = f, ...g } of _mark3_)
            for (var [h, i = j] in _mark4_) _mark5_;
        for (const { k = l, m: n = o } of {})
            ((p = q, ...r: s) => (_mark6_, t))(_mark7_)
    `

    checkScopeIdentifiersByMatrix(source, [
        ["a", "b"],
        ["a", "b"],
        [],
        ["c", "e", "g"],
        ["c", "e", "g"],
        ["k", "n", "p", "r"],
        ["k", "n"]
    ])
})

test("Generic type parameters do not become runtime identifiers", () => {
    const source = `
        function a<b>() {
            _mark1_
        }

        const c = <d,>() => _mark2_
    `

    checkScopeIdentifiersByMatrix(source, [["a"], []])
})

test("Generic: type-only references do not pollute runtime scopeIdentifiers", () => {
    const source = `
        {
            const a = 1

            function b<c extends d = e>(f: c): g<c> {
                _mark1_
                return f
            }

            const h = <i extends j = k>(l: i): m<i> => (_mark2_, l)
        }
    `

    checkScopeIdentifiersByMatrix(source, [
        ["a", "b", "f", "h"],
        ["a", "b", "h", "l"]
    ])
})
